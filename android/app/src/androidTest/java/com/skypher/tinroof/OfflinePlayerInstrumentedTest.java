package com.skypher.tinroof;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ProviderInfo;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public final class OfflinePlayerInstrumentedTest {
    private static final long PAGE_TIMEOUT_MS = 60_000;

    private Activity activity;
    private WebView webView;
    private String lastSeekState = "not attempted";

    @Before
    public void launchPlayer() throws Exception {
        Intent intent = new Intent(
                InstrumentationRegistry.getInstrumentation().getTargetContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        activity = InstrumentationRegistry.getInstrumentation().startActivitySync(intent);
        assertNotNull(activity);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            webView = findWebView(activity.getWindow().getDecorView());
        });
        assertNotNull("Activity must display its player WebView", webView);
        eval("window.__tinroofErrors = [];"
                + "addEventListener('error', e => window.__tinroofErrors.push(e.message));"
                + "addEventListener('unhandledrejection', e => window.__tinroofErrors.push(String(e.reason))); true");

        waitForJsTrue("document.readyState === 'complete'"
                + " && !!document.querySelector('#toggle')"
                + " && performance.getEntriesByType('resource').some(e => e.name.endsWith('/assets/app.js'))",
                PAGE_TIMEOUT_MS, "The bundled page and app.js did not finish loading");
    }

    @After
    public void closePlayer() {
        if (activity != null) {
            Activity closingActivity = activity;
            InstrumentationRegistry.getInstrumentation().runOnMainSync(closingActivity::finish);
        }
    }

    @Test
    public void offlineShellServesItsBundledAssetsAndBlocksNetworkLoads() throws Exception {
        WebSettings settings = onMain(() -> webView.getSettings());
        assertTrue("Network resource loads must remain disabled", settings.getBlockNetworkLoads());
        assertFalse("File URL access must remain disabled", settings.getAllowFileAccess());
        assertTrue("The private APK audio provider must be available to the player", settings.getAllowContentAccess());
        assertTrue("WebView JavaScript is required by the bundled player", settings.getJavaScriptEnabled());

        AssetManager assets = activity.getAssets();
        String[] rootAssets = assets.list("");
        assertContains(rootAssets, "index.html");
        assertContains(rootAssets, "style.css");
        assertContains(rootAssets, "app.js");
        assertContains(rootAssets, "live.js");
        assertContains(rootAssets, "storm-core.js");
        assertContains(rootAssets, "storm-worklet.js");

        JSONObject manifest = new JSONObject(readText(assets.open("samples/manifest.json")));
        assertTrue("Sample manifest should contain the live sound library", manifest.length() >= 20);
        for (Iterator<String> keys = manifest.keys(); keys.hasNext();) {
            String key = keys.next();
            String assetPath = manifest.getString(key);
            try (InputStream stream = assets.open(assetPath)) {
                assertTrue("Bundled sample is empty: " + assetPath, stream.read() >= 0);
            }
        }
        for (String path : new String[] {
                "audio/storm.mp3", "audio/hour-2.mp3", "audio/hour-8.mp3"}) {
            try (InputStream stream = assets.open(path)) {
                assertTrue("Bundled recording is empty: " + path, stream.read() >= 0);
            }
        }
        Uri audioUri = AudioAssetProvider.uriFor(activity, "audio/storm.mp3");
        assertNotNull("The recording must have a provider URI", audioUri);
        assertEquals("content", audioUri.getScheme());
        assertNull("Provider must reject non-recording assets",
                AudioAssetProvider.uriFor(activity, "../samples/manifest.json"));
        ProviderInfo provider = activity.getPackageManager().resolveContentProvider(audioUri.getAuthority(), 0);
        assertNotNull("Audio provider must be installed", provider);
        assertFalse("Audio provider must not be exported", provider.exported);
        try (AssetFileDescriptor descriptor = activity.getContentResolver()
                .openAssetFileDescriptor(audioUri, "r");
             InputStream stream = descriptor.createInputStream()) {
            assertTrue("Provider must expose a seekable APK descriptor", descriptor.getLength() > 0);
            assertEquals("Provider descriptor must reach the recording tail",
                    71_892_992L, stream.skip(71_892_992L));
            assertTrue("Provider descriptor must read tail bytes", stream.read() >= 0);
        }
        assertEquals(audioUri.toString(), unquote(eval("TinroofAudioAssets.uriFor('audio/storm.mp3')")));
        assertEquals("", unquote(eval("TinroofAudioAssets.uriFor('../samples/manifest.json')")));

        waitForJsTrue("document.styleSheets.length > 0"
                + " && getComputedStyle(document.documentElement).backgroundColor !== 'rgba(0, 0, 0, 0)'",
                10_000, "Bundled CSS did not apply");
        eval("fetch('samples/manifest.json').then(r => r.json())"
                + ".then(m => window.__manifestCount = Object.keys(m).length)"
                + ".catch(e => window.__manifestError = String(e)); true");
        waitForJsTrue("typeof window.__manifestCount === 'number'", 15_000,
                "The WebView could not fetch the APK-bundled sample manifest");
        assertTrue("WebView must receive all manifest entries from APK assets",
                Integer.parseInt(eval("window.__manifestCount")) >= 20);
        assertEquals("Tinroof — A passing storm", unquote(eval("document.title")));
        assertTrue("The player page should not report an error", unquote(eval("document.querySelector('#error').textContent")).isEmpty());
    }

    @Test
    public void recordingsPlayPauseAndCrossBothPlaylistBoundaries() throws Exception {
        tap("#toggle");
        waitForJsTrue("document.querySelector('#toggle').getAttribute('aria-label') === 'Pause storm'"
                + " && !document.querySelector('#audio').paused"
                + " && document.querySelector('#audio').currentTime > 0.25",
                20_000, "The original recording did not start and advance");
        tap("#toggle");
        waitForJsTrue("document.querySelector('#toggle').getAttribute('aria-label') === 'Play storm'"
                + " && document.querySelector('#audio').paused", 10_000,
                "The original recording did not pause");

        setSelect("#mode", "4");
        assertEquals("14400", unquote(eval("document.querySelector('#seek').max")));
        primeCurrentRecording();
        seekTo("3596");
        waitForJsTrue("document.querySelector('#audio').readyState >= 1"
                + " && document.querySelector('#audio').currentTime >= 3595",
                20_000, "The four-hour recording did not seek to its first boundary");
        tap("#toggle");
        waitForJsTrue("Number(document.querySelector('#seek').value) >= 3600"
                + " && Number(document.querySelector('#seek').value) < 3650"
                + " && document.querySelector('#toggle').getAttribute('aria-label') === 'Pause storm'",
                25_000, "The four-hour playlist did not advance into hour two");
        tap("#toggle");

        setSelect("#mode", "8");
        assertEquals("28800", unquote(eval("document.querySelector('#seek').max")));
        primeCurrentRecording();
        seekTo("28796");
        waitForJsTrue("document.querySelector('#audio').readyState >= 1"
                + " && document.querySelector('#audio').currentTime >= 3595",
                20_000, "The eight-hour recording did not seek to its final boundary");
        tap("#toggle");
        waitForJsTrue("Number(document.querySelector('#seek').value) < 5"
                + " && document.querySelector('#toggle').getAttribute('aria-label') === 'Pause storm'",
                25_000, "The eight-hour playlist did not wrap to its first recording");
        tap("#toggle");
        waitForJsTrue("document.querySelector('#audio').paused", 10_000,
                "Playback did not pause after the playlist wrap");
    }

    @Test
    public void endlessModeLoadsSamplesGeneratesAudioAndHonorsControls() throws Exception {
        installAudioProbe();
        setSelect("#mode", "live");
        setSelect("#cycle", "2");
        setSelect("#pace", "0.5");
        assertEquals("14400", unquote(eval("document.querySelector('#seek').max")));
        assertTrue(unquote(eval("document.querySelector('#hint').textContent")).contains("240-minute cycles"));

        tap("#toggle");
        waitForJsTrue("window.__tinroofContext?.state === 'running'"
                + " && document.querySelector('#toggle').getAttribute('aria-label') === 'Pause storm'"
                + " && document.querySelector('#state').textContent !== 'Gathering sounds…'"
                + " && !document.querySelector('#state').textContent.startsWith('Gathering sounds')",
                90_000, "Endless mode did not finish loading and start its AudioWorklet");
        waitForJsTrue("window.__tinroofSignal()", 15_000,
                "The Endless AudioWorklet produced no measurable audio signal");

        for (String id : new String[] {"intensity", "crickets", "frogs"}) {
            setInput(id, "0");
        }
        waitForJsTrue("window.__tinroofSilent()", 10_000,
                "Zeroed sound controls did not mute the generated signal");

        for (String id : new String[] {"intensity", "crickets", "frogs"}) {
            setInput(id, "1");
        }
        waitForJsTrue("window.__tinroofSignal()", 10_000,
                "Restoring the sound controls did not restore generated audio");

        tap("#toggle");
        waitForJsTrue("window.__tinroofContext.state === 'suspended'"
                + " && document.querySelector('#toggle').getAttribute('aria-label') === 'Play storm'",
                10_000, "Endless audio did not suspend on pause");
        tap("#toggle");
        waitForJsTrue("window.__tinroofContext.state === 'running'"
                + " && document.querySelector('#toggle').getAttribute('aria-label') === 'Pause storm'",
                15_000, "Endless audio did not resume");

        eval("window.__tinroofErrors = window.__tinroofErrors || []");
        assertEquals("[]", unquote(eval("JSON.stringify(window.__tinroofErrors)")));
        tap("#toggle");
    }

    private void installAudioProbe() throws Exception {
        String script = "(() => {"
                + "window.__tinroofErrors = [];"
                + "addEventListener('error', e => window.__tinroofErrors.push(e.message));"
                + "addEventListener('unhandledrejection', e => window.__tinroofErrors.push(String(e.reason)));"
                + "const Original = window.AudioWorkletNode;"
                + "window.AudioWorkletNode = class extends Original {"
                + "constructor(context, ...args) { super(context, ...args);"
                + "window.__tinroofContext = context;"
                + "const analyser = context.createAnalyser(); analyser.fftSize = 2048;"
                + "this.connect(analyser); window.__tinroofAnalyser = analyser; } };"
                + "window.__tinroofSignal = () => { const a = window.__tinroofAnalyser;"
                + "if (!a) return false; const data = new Float32Array(a.fftSize);"
                + "a.getFloatTimeDomainData(data); return data.some(v => Math.abs(v) > 0.00001); };"
                + "window.__tinroofSilent = () => { const a = window.__tinroofAnalyser;"
                + "if (!a) return false; const data = new Float32Array(a.fftSize);"
                + "a.getFloatTimeDomainData(data); return data.every(v => Math.abs(v) < 0.000001); };"
                + "return typeof Original === 'function'; })()";
        assertEquals("true", eval(script));
    }

    private void setSelect(String selector, String value) throws Exception {
        String eventName = "#mode".equals(selector) ? "change" : "input";
        String script = "(() => { const e = document.querySelector('" + selector + "');"
                + "e.value = '" + value + "'; e.dispatchEvent(new Event('" + eventName + "', {bubbles:true}));"
                + "return e.value; })()";
        assertEquals(value, unquote(eval(script)));
    }

    private void setInput(String id, String value) throws Exception {
        String script = "(() => { const e = document.getElementById('" + id + "');"
                + "e.value = '" + value + "'; e.dispatchEvent(new Event('input', {bubbles:true}));"
                + "return e.value; })()";
        assertEquals(value, unquote(eval(script)));
    }

    private void seekTo(String value) throws Exception {
        String script = "(() => { const e = document.querySelector('#seek');"
                + "e.value = '" + value + "'; e.dispatchEvent(new Event('change', {bubbles:true}));"
                + "const a = document.querySelector('#audio'); return JSON.stringify({input:e.value,"
                + "max:e.max,time:a.currentTime,duration:a.duration,seekable:a.seekable.length,"
                + "errors:window.__tinroofErrors}); })()";
        lastSeekState = unquote(eval(script));
    }

    private void primeCurrentRecording() throws Exception {
        tap("#toggle");
        waitForJsTrue("!document.querySelector('#audio').paused"
                + " && document.querySelector('#audio').currentTime > 0.25",
                20_000, "The selected recording did not start to load");
        tap("#toggle");
        waitForJsTrue("document.querySelector('#audio').paused"
                + " && document.querySelector('#audio').readyState >= 1",
                10_000, "The selected recording did not pause after loading metadata");
    }

    private void tap(String selector) throws Exception {
        double x = Double.parseDouble(eval("(() => { const e = document.querySelector('" + selector + "');"
                + "e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect();"
                + "return r.left + r.width / 2; })()"));
        double y = Double.parseDouble(eval("(() => { const e = document.querySelector('" + selector + "');"
                + "const r = e.getBoundingClientRect(); return r.top + r.height / 2; })()"));
        double viewportWidth = Double.parseDouble(eval("document.documentElement.clientWidth"));
        int[] location = new int[2];
        int[] dimensions = new int[2];
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            webView.getLocationOnScreen(location);
            dimensions[0] = webView.getWidth();
            dimensions[1] = webView.getHeight();
        });
        assertTrue("WebView must be laid out before taps", dimensions[0] > 0 && dimensions[1] > 0);
        float scale = (float) (dimensions[0] / viewportWidth);
        float screenX = location[0] + (float) x * scale;
        float screenY = location[1] + (float) y * scale;

        long downTime = SystemClock.uptimeMillis();
        sendTouch(downTime, downTime, MotionEvent.ACTION_DOWN, screenX, screenY);
        SystemClock.sleep(80);
        sendTouch(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, screenX, screenY);
    }

    private void sendTouch(long downTime, long eventTime, int action, float x, float y) {
        MotionEvent event = MotionEvent.obtain(downTime, eventTime, action, x, y, 0);
        event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        InstrumentationRegistry.getInstrumentation().sendPointerSync(event);
        event.recycle();
    }

    private void waitForJsTrue(String expression, long timeoutMs, String message) throws Exception {
        long deadline = SystemClock.uptimeMillis() + timeoutMs;
        String last = "";
        while (SystemClock.uptimeMillis() < deadline) {
            last = eval(expression);
            if ("true".equals(last)) {
                return;
            }
            SystemClock.sleep(200);
        }
        String mediaState = unquote(eval("(() => { const a = document.querySelector('#audio');"
                + "const s = document.querySelector('#seek'); return JSON.stringify({src:a?.src,"
                + "readyState:a?.readyState,currentTime:a?.currentTime,duration:a?.duration,"
                + "paused:a?.paused,seek:s?.value,max:s?.max,seekable:a?.seekable?.length,"
                + "seekableStart:a?.seekable?.length?a.seekable.start(0):null,"
                + "seekableEnd:a?.seekable?.length?a.seekable.end(0):null,"
                + "errors:window.__tinroofErrors,error:document.querySelector('#error')?.textContent}); })()"));
        String directSeekState = unquote(eval("(() => { const a = document.querySelector('#audio');"
                + "try { a.currentTime = 3596; return JSON.stringify({time:a.currentTime,seeking:a.seeking,"
                + "seekable:a.seekable.length,start:a.seekable.length?a.seekable.start(0):null,"
                + "end:a.seekable.length?a.seekable.end(0):null}); } catch(e) { return JSON.stringify({error:String(e)}); } })()"));
        assertTrue(message + " (last JavaScript value: " + last + "; media state: " + mediaState
                + "; after seek event: " + lastSeekState + "; direct seek: " + directSeekState + ")", false);
    }

    private String eval(String javascript) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(
                () -> webView.evaluateJavascript(javascript, value -> {
                    result.set(value);
                    latch.countDown();
                }));
        assertTrue("Timed out waiting for WebView JavaScript", latch.await(5, TimeUnit.SECONDS));
        return result.get();
    }

    private <T> T onMain(java.util.concurrent.Callable<T> callable) throws Exception {
        AtomicReference<T> result = new AtomicReference<>();
        AtomicReference<Exception> error = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                result.set(callable.call());
            } catch (Exception e) {
                error.set(e);
            }
        });
        if (error.get() != null) {
            throw error.get();
        }
        return result.get();
    }

    private static WebView findWebView(View view) {
        if (view instanceof WebView) {
            return (WebView) view;
        }
        if (view instanceof android.view.ViewGroup) {
            android.view.ViewGroup group = (android.view.ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView candidate = findWebView(group.getChildAt(i));
                if (candidate != null) {
                    return candidate;
                }
            }
        }
        return null;
    }

    private static String readText(InputStream stream) throws Exception {
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) {
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static String unquote(String value) {
        if (value == null || value.length() < 2 || value.charAt(0) != '"'
                || value.charAt(value.length() - 1) != '"') {
            return value;
        }
        return value.substring(1, value.length() - 1)
                .replace("\\n", "\n")
                .replace("\\r", "\r")
                .replace("\\\"", "\"")
                .replace("\\\\", "\\");
    }

    private static void assertContains(String[] values, String expected) {
        for (String value : values) {
            if (expected.equals(value)) {
                return;
            }
        }
        assertTrue("Missing APK asset: " + expected, false);
    }
}
