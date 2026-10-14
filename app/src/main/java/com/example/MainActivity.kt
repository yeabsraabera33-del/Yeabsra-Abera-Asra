package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.ui.navigation.Screen
import com.example.ui.screens.GalleryScreen
import com.example.ui.screens.HomeScreen
import com.example.ui.screens.ImageGenerationScreen
import com.example.ui.screens.ImageToVideoScreen
import com.example.ui.screens.MediaViewerDialog
import com.example.ui.screens.SettingsScreen
import com.example.ui.screens.VideoGenerationScreen
import com.example.ui.theme.CreatorAITheme
import com.example.ui.theme.DarkBorder
import com.example.ui.theme.DarkSurface
import com.example.ui.theme.DarkSurfaceElevated
import com.example.ui.theme.NeonCyan
import com.example.ui.viewmodel.CreatorViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CreatorAITheme {
                CreatorAIApp()
            }
        }
    }
}

@Composable
fun CreatorAIApp(
    viewModel: CreatorViewModel = viewModel()
) {
    var currentScreen by remember { mutableStateOf<Screen>(Screen.Home) }
    val snackbarHostState = remember { SnackbarHostState() }
    val feedbackToast by viewModel.feedbackToast.collectAsState()
    val selectedItemForDetail by viewModel.selectedItemForDetail.collectAsState()

    // Handle back button on secondary screens
    if (currentScreen != Screen.Home) {
        BackHandler {
            currentScreen = Screen.Home
        }
    }

    LaunchedEffect(feedbackToast) {
        feedbackToast?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.clearToast()
        }
    }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .testTag("creator_ai_scaffold"),
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            NavigationBar(
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("main_bottom_nav"),
                containerColor = DarkSurface,
                contentColor = Color.White,
                tonalElevation = 8.dp
            ) {
                Screen.navItems.forEach { screen ->
                    val isSelected = currentScreen == screen
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { currentScreen = screen },
                        icon = {
                            Icon(
                                imageVector = screen.icon,
                                contentDescription = screen.title,
                                modifier = Modifier.size(20.dp)
                            )
                        },
                        label = {
                            Text(
                                text = screen.title,
                                fontSize = 10.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color.Black,
                            selectedTextColor = NeonCyan,
                            unselectedIconColor = Color.Gray,
                            unselectedTextColor = Color.Gray,
                            indicatorColor = NeonCyan
                        ),
                        modifier = Modifier.testTag("nav_item_${screen.route}")
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFF0B0F17))
        ) {
            when (currentScreen) {
                Screen.Home -> HomeScreen(
                    viewModel = viewModel,
                    onNavigate = { currentScreen = it }
                )
                Screen.GenerateImage -> ImageGenerationScreen(viewModel = viewModel)
                Screen.GenerateVideo -> VideoGenerationScreen(viewModel = viewModel)
                Screen.ImageToVideo -> ImageToVideoScreen(viewModel = viewModel)
                Screen.Gallery -> GalleryScreen(
                    viewModel = viewModel,
                    onNavigate = { currentScreen = it }
                )
                Screen.Settings -> SettingsScreen(viewModel = viewModel)
            }
        }
    }

    // Fullscreen Media Viewer Dialog
    selectedItemForDetail?.let { item ->
        MediaViewerDialog(
            item = item,
            onDismiss = { viewModel.setSelectedItemForDetail(null) },
            onDownload = {
                viewModel.downloadToDevice(it)
                viewModel.setSelectedItemForDetail(null)
            },
            onDelete = {
                viewModel.deleteItem(it)
            },
            onToggleFavorite = {
                viewModel.toggleFavorite(it)
            }
        )
    }
}
