package com.example.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.api.GenerationRepository
import com.example.data.local.AppDatabase
import com.example.data.local.GenerationItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class CreatorViewModel(application: Application) : AndroidViewModel(application) {
    private val database = AppDatabase.getDatabase(application)
    private val repository = GenerationRepository(application, database.generationDao())

    // Styles supported per user requirements
    val supportedStyles = listOf(
        "Photorealistic",
        "Cinematic",
        "Anime",
        "Cartoon",
        "3D render",
        "Stickman",
        "Scientific illustration",
        "Space and astronomy",
        "Fantasy",
        "Minimalist"
    )

    // Aspect ratios with dimensions
    val aspectRatios = listOf(
        "1:1" to (1024 to 1024),
        "16:9" to (1280 to 720),
        "9:16" to (720 to 1280),
        "4:3" to (1024 to 768),
        "3:4" to (768 to 1024)
    )

    // Image Generation State
    private val _imagePrompt = MutableStateFlow("")
    val imagePrompt = _imagePrompt.asStateFlow()

    private val _selectedStyle = MutableStateFlow("Photorealistic")
    val selectedStyle = _selectedStyle.asStateFlow()

    private val _selectedAspectRatio = MutableStateFlow("1:1")
    val selectedAspectRatio = _selectedAspectRatio.asStateFlow()

    private val _selectedImageModel = MutableStateFlow("flux")
    val selectedImageModel = _selectedImageModel.asStateFlow()

    private val _isEnhancingPrompt = MutableStateFlow(false)
    val isEnhancingPrompt = _isEnhancingPrompt.asStateFlow()

    private val _isGeneratingImage = MutableStateFlow(false)
    val isGeneratingImage = _isGeneratingImage.asStateFlow()

    private val _imageStatusMessage = MutableStateFlow("")
    val imageStatusMessage = _imageStatusMessage.asStateFlow()

    private val _imageError = MutableStateFlow<String?>(null)
    val imageError = _imageError.asStateFlow()

    private val _lastGeneratedImage = MutableStateFlow<GenerationItem?>(null)
    val lastGeneratedImage = _lastGeneratedImage.asStateFlow()

    // Video Generation State
    private val _videoPrompt = MutableStateFlow("")
    val videoPrompt = _videoPrompt.asStateFlow()

    private val _videoDuration = MutableStateFlow(4)
    val videoDuration = _videoDuration.asStateFlow()

    private val _videoAspectRatio = MutableStateFlow("16:9")
    val videoAspectRatio = _videoAspectRatio.asStateFlow()

    private val _videoModel = MutableStateFlow("Free Open Motion Engine")
    val videoModel = _videoModel.asStateFlow()

    private val _isGeneratingVideo = MutableStateFlow(false)
    val isGeneratingVideo = _isGeneratingVideo.asStateFlow()

    private val _videoProgress = MutableStateFlow(0f)
    val videoProgress = _videoProgress.asStateFlow()

    private val _videoStatusMessage = MutableStateFlow("")
    val videoStatusMessage = _videoStatusMessage.asStateFlow()

    private val _videoError = MutableStateFlow<String?>(null)
    val videoError = _videoError.asStateFlow()

    private val _lastGeneratedVideo = MutableStateFlow<GenerationItem?>(null)
    val lastGeneratedVideo = _lastGeneratedVideo.asStateFlow()

    // Image-To-Video State
    private val _inputImageUri = MutableStateFlow<String?>(null)
    val inputImageUri = _inputImageUri.asStateFlow()

    private val _motionPrompt = MutableStateFlow("")
    val motionPrompt = _motionPrompt.asStateFlow()

    private val _isGeneratingMotion = MutableStateFlow(false)
    val isGeneratingMotion = _isGeneratingMotion.asStateFlow()

    private val _motionProgress = MutableStateFlow(0f)
    val motionProgress = _motionProgress.asStateFlow()

    private val _motionStatusMessage = MutableStateFlow("")
    val motionStatusMessage = _motionStatusMessage.asStateFlow()

    private val _motionError = MutableStateFlow<String?>(null)
    val motionError = _motionError.asStateFlow()

    private val _lastGeneratedMotion = MutableStateFlow<GenerationItem?>(null)
    val lastGeneratedMotion = _lastGeneratedMotion.asStateFlow()

    // Gallery and Details State
    private val _galleryFilter = MutableStateFlow("ALL") // "ALL", "IMAGE", "VIDEO", "FAVORITE"
    val galleryFilter = _galleryFilter.asStateFlow()

    private val _selectedItemForDetail = MutableStateFlow<GenerationItem?>(null)
    val selectedItemForDetail = _selectedItemForDetail.asStateFlow()

    private val _feedbackToast = MutableStateFlow<String?>(null)
    val feedbackToast = _feedbackToast.asStateFlow()

    val filteredGenerations: StateFlow<List<GenerationItem>> = combine(
        repository.allGenerations,
        _galleryFilter
    ) { list, filter ->
        when (filter) {
            "IMAGE" -> list.filter { it.type == "IMAGE" }
            "VIDEO" -> list.filter { it.type == "VIDEO" }
            "FAVORITE" -> list.filter { it.isFavorite }
            else -> list
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Setters
    fun setImagePrompt(value: String) { _imagePrompt.value = value }
    fun setStyle(value: String) { _selectedStyle.value = value }
    fun setAspectRatio(value: String) { _selectedAspectRatio.value = value }
    fun setImageModel(value: String) { _selectedImageModel.value = value }

    fun setVideoPrompt(value: String) { _videoPrompt.value = value }
    fun setVideoDuration(seconds: Int) { _videoDuration.value = seconds }
    fun setVideoAspectRatio(value: String) { _videoAspectRatio.value = value }
    fun setVideoModel(value: String) { _videoModel.value = value }

    fun setInputImageUri(uri: String?) { _inputImageUri.value = uri }
    fun setMotionPrompt(value: String) { _motionPrompt.value = value }

    fun setGalleryFilter(filter: String) { _galleryFilter.value = filter }
    fun setSelectedItemForDetail(item: GenerationItem?) { _selectedItemForDetail.value = item }
    fun clearToast() { _feedbackToast.value = null }

    fun enhanceImagePrompt() {
        val current = _imagePrompt.value
        if (current.isBlank()) {
            _imageError.value = "Please enter a prompt idea first to enhance it."
            return
        }
        viewModelScope.launch {
            _isEnhancingPrompt.value = true
            _imageError.value = null
            try {
                val enhanced = repository.enhancePrompt(current, _selectedStyle.value)
                _imagePrompt.value = enhanced
                _feedbackToast.value = "Prompt enhanced with creative visual details!"
            } catch (e: Exception) {
                _imageError.value = "Failed to enhance prompt: ${e.message}"
            } finally {
                _isEnhancingPrompt.value = false
            }
        }
    }

    fun enhanceVideoPrompt() {
        val current = _videoPrompt.value
        if (current.isBlank()) {
            _videoError.value = "Please enter a prompt idea first to enhance it."
            return
        }
        viewModelScope.launch {
            _isEnhancingPrompt.value = true
            _videoError.value = null
            try {
                val enhanced = repository.enhancePrompt(current, "Cinematic Film Video")
                _videoPrompt.value = enhanced
                _feedbackToast.value = "Video prompt enhanced for cinematic motion!"
            } catch (e: Exception) {
                _videoError.value = "Failed to enhance video prompt: ${e.message}"
            } finally {
                _isEnhancingPrompt.value = false
            }
        }
    }

    fun generateImage() {
        val prompt = _imagePrompt.value.trim()
        if (prompt.isBlank()) {
            _imageError.value = "Please enter an image prompt."
            return
        }
        viewModelScope.launch {
            _isGeneratingImage.value = true
            _imageError.value = null
            _imageStatusMessage.value = "Initializing generator..."

            val pair = aspectRatios.find { it.first == _selectedAspectRatio.value }?.second ?: (1024 to 1024)
            val result = repository.generateImage(
                prompt = prompt,
                style = _selectedStyle.value,
                aspectRatio = _selectedAspectRatio.value,
                width = pair.first,
                height = pair.second,
                model = _selectedImageModel.value,
                onProgress = { msg -> _imageStatusMessage.value = msg }
            )

            result.fold(
                onSuccess = { item ->
                    _lastGeneratedImage.value = item
                    _imageStatusMessage.value = "Completed!"
                    _feedbackToast.value = "Image generated and saved to your gallery!"
                },
                onFailure = { err ->
                    _imageError.value = err.message ?: "Failed to generate image"
                }
            )
            _isGeneratingImage.value = false
        }
    }

    fun generateVideo() {
        val prompt = _videoPrompt.value.trim()
        if (prompt.isBlank()) {
            _videoError.value = "Please describe the video you want to generate."
            return
        }
        viewModelScope.launch {
            _isGeneratingVideo.value = true
            _videoError.value = null
            _videoProgress.value = 0.05f
            _videoStatusMessage.value = "Starting video engine..."

            val result = repository.generateVideo(
                prompt = prompt,
                durationSeconds = _videoDuration.value,
                aspectRatio = _videoAspectRatio.value,
                onStatusUpdate = { status, progress ->
                    _videoStatusMessage.value = status
                    _videoProgress.value = progress
                }
            )

            result.fold(
                onSuccess = { item ->
                    _lastGeneratedVideo.value = item
                    _videoStatusMessage.value = "Video generation complete!"
                    _feedbackToast.value = "Video clip ready in your gallery!"
                },
                onFailure = { err ->
                    _videoError.value = err.message ?: "Video generation failed"
                }
            )
            _isGeneratingVideo.value = false
        }
    }

    fun generateImageToVideo() {
        val imageUri = _inputImageUri.value
        val motion = _motionPrompt.value.trim()
        if (imageUri.isNullOrBlank()) {
            _motionError.value = "Please select or capture a source image first."
            return
        }
        if (motion.isBlank()) {
            _motionError.value = "Please describe how the image should animate or move."
            return
        }

        viewModelScope.launch {
            _isGeneratingMotion.value = true
            _motionError.value = null
            _motionProgress.value = 0.05f
            _motionStatusMessage.value = "Analyzing source image and motion vectors..."

            val result = repository.generateVideo(
                prompt = motion,
                durationSeconds = 4,
                aspectRatio = "16:9",
                inputImageUri = imageUri,
                onStatusUpdate = { status, progress ->
                    _motionStatusMessage.value = status
                    _motionProgress.value = progress
                }
            )

            result.fold(
                onSuccess = { item ->
                    _lastGeneratedMotion.value = item
                    _motionStatusMessage.value = "Motion animation rendered successfully!"
                    _feedbackToast.value = "Animated clip saved to gallery!"
                },
                onFailure = { err ->
                    _motionError.value = err.message ?: "Failed to animate image"
                }
            )
            _isGeneratingMotion.value = false
        }
    }

    fun deleteItem(item: GenerationItem) {
        viewModelScope.launch {
            repository.deleteGeneration(item)
            if (_selectedItemForDetail.value?.id == item.id) {
                _selectedItemForDetail.value = null
            }
            if (_lastGeneratedImage.value?.id == item.id) {
                _lastGeneratedImage.value = null
            }
            if (_lastGeneratedVideo.value?.id == item.id) {
                _lastGeneratedVideo.value = null
            }
            _feedbackToast.value = "Item removed from gallery"
        }
    }

    fun toggleFavorite(item: GenerationItem) {
        viewModelScope.launch {
            repository.toggleFavorite(item.id, !item.isFavorite)
            _selectedItemForDetail.value = _selectedItemForDetail.value?.copy(isFavorite = !item.isFavorite)
        }
    }

    fun downloadToDevice(item: GenerationItem) {
        viewModelScope.launch {
            val res = repository.saveMediaToGallery(item)
            res.fold(
                onSuccess = { msg ->
                    _feedbackToast.value = msg
                },
                onFailure = { err ->
                    _feedbackToast.value = "Export failed: ${err.message}"
                }
            )
        }
    }
}
