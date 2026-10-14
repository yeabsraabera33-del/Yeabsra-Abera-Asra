package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "generations")
data class GenerationItem(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val type: String, // "IMAGE" or "VIDEO"
    val prompt: String,
    val enhancedPrompt: String? = null,
    val style: String = "Photorealistic",
    val aspectRatio: String = "1:1",
    val width: Int = 1024,
    val height: Int = 1024,
    val modelName: String = "FLUX (Free)",
    val provider: String = "Pollinations Free",
    val mediaUri: String, // local file path or cache uri
    val originalImageUri: String? = null, // for image-to-video
    val durationSeconds: Int = 0, // for video
    val createdAt: Long = System.currentTimeMillis(),
    val isFavorite: Boolean = false,
    val status: String = "COMPLETED" // "QUEUED", "PROCESSING", "COMPLETED", "FAILED"
)
