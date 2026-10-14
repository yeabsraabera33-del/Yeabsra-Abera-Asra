package com.example.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Collections
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    data object Home : Screen("home", "Home", Icons.Default.Home)
    data object GenerateImage : Screen("generate_image", "Image", Icons.Default.Image)
    data object GenerateVideo : Screen("generate_video", "Video", Icons.Default.Videocam)
    data object ImageToVideo : Screen("image_to_video", "Motion", Icons.Default.Movie)
    data object Gallery : Screen("gallery", "Gallery", Icons.Default.Collections)
    data object Settings : Screen("settings", "Settings", Icons.Default.Settings)

    companion object {
        val navItems: List<Screen>
            get() = listOf(
                Home,
                GenerateImage,
                GenerateVideo,
                ImageToVideo,
                Gallery,
                Settings
            )
    }
}
