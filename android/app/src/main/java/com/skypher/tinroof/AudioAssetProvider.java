package com.skypher.tinroof;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import java.io.FileNotFoundException;
import java.io.IOException;

public final class AudioAssetProvider extends ContentProvider {
    private static final String AUTHORITY_SUFFIX = ".audio-assets";

    public static Uri uriFor(Context context, String assetPath) {
        String fileName = recordingName(assetPath);
        if (fileName == null) {
            return null;
        }
        return new Uri.Builder()
                .scheme("content")
                .authority(context.getPackageName() + AUTHORITY_SUFFIX)
                .appendPath("audio")
                .appendPath(fileName)
                .build();
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public String getType(Uri uri) {
        return assetPath(uri) == null ? null : "audio/mpeg";
    }

    @Override
    public AssetFileDescriptor openAssetFile(Uri uri, String mode) throws FileNotFoundException {
        String assetPath = assetPath(uri);
        if (assetPath == null || !"r".equals(mode)) {
            throw new FileNotFoundException("Unsupported audio asset request");
        }
        try {
            return getContext().getAssets().openFd(assetPath);
        } catch (IOException error) {
            FileNotFoundException missing = new FileNotFoundException(assetPath);
            missing.initCause(error);
            throw missing;
        }
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
            String[] selectionArgs, String sortOrder) {
        String path = assetPath(uri);
        if (path == null) {
            return null;
        }
        String[] columns = projection == null
                ? new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}
                : projection;
        try (AssetFileDescriptor descriptor = getContext().getAssets().openFd(path)) {
            Object[] values = new Object[columns.length];
            String fileName = path.substring("audio/".length());
            for (int i = 0; i < columns.length; i++) {
                if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) {
                    values[i] = fileName;
                } else if (OpenableColumns.SIZE.equals(columns[i])) {
                    values[i] = descriptor.getLength();
                }
            }
            MatrixCursor cursor = new MatrixCursor(columns, 1);
            cursor.addRow(values);
            return cursor;
        } catch (IOException error) {
            return null;
        }
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Audio assets are read-only");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Audio assets are read-only");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Audio assets are read-only");
    }

    private static String assetPath(Uri uri) {
        if (uri == null || !"content".equals(uri.getScheme())
                || uri.getPathSegments().size() != 2
                || !"audio".equals(uri.getPathSegments().get(0))) {
            return null;
        }
        String fileName = uri.getPathSegments().get(1);
        return recordingName("audio/" + fileName) == null ? null : "audio/" + fileName;
    }

    private static String recordingName(String assetPath) {
        if (assetPath == null || !assetPath.startsWith("audio/")) {
            return null;
        }
        String fileName = assetPath.substring("audio/".length());
        if ("storm.mp3".equals(fileName)) {
            return fileName;
        }
        for (int hour = 2; hour <= 8; hour++) {
            if (("hour-" + hour + ".mp3").equals(fileName)) {
                return fileName;
            }
        }
        return null;
    }
}
