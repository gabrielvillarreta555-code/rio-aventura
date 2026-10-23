plugins { id("com.android.application") }

android {
    namespace = "com.example.rioaventura"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.rioaventura"
        minSdk = 26
        targetSdk = 35
        versionCode = 14
        versionName = "2.3"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
