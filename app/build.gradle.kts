plugins { id("com.android.application") }

android {
    namespace = "com.example.rioaventura"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.rioaventura"
        minSdk = 26
        targetSdk = 35
        versionCode = 8
        versionName = "1.7"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
