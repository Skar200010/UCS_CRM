# Mobile Scanner (ML Kit Barcode Scanning)
-keep class com.google.mlkit.vision.barcode.** { *; }
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.vision.** { *; }

# CameraX
-keep class androidx.camera.** { *; }

# Networking (Http, Supabase, WebSocket)
-dontwarn okhttp3.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okio.**
-keep class okio.** { *; }
-keep class org.jetbrains.skia.** { *; }

# Supabase / PostgREST / Realtime
-keep class com.supabase.** { *; }
-keep class io.postgrest.** { *; }
-keep class io.realtime.** { *; }

# Dart/Flutter networking
-keep class dart.** { *; }
-keep class org.dartlang.** { *; }

# Geolocator
-keep class com.google.android.gms.location.** { *; }
-keep class com.google.android.gms.tasks.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# JSON parsing
-keep class org.json.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# Keep HTTP client classes
-keep class org.apache.** { *; }
-dontwarn org.apache.**
