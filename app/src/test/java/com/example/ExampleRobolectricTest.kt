package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.data.local.AppDatabase
import com.example.data.local.GenerationItem
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("CreatorAI", appName)
  }

  @Test
  fun `room database insert and query`() = runBlocking {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val db = AppDatabase.getDatabase(context)
    val dao = db.generationDao()

    val item = GenerationItem(
      type = "IMAGE",
      prompt = "A majestic dragon perched on a mountain",
      style = "Fantasy",
      aspectRatio = "1:1",
      width = 1024,
      height = 1024,
      modelName = "FLUX.1",
      provider = "Pollinations Free",
      mediaUri = "/path/to/test.jpg"
    )

    val id = dao.insertGeneration(item)
    assertTrue(id > 0)

    val retrieved = dao.getGenerationById(id)
    assertNotNull(retrieved)
    assertEquals("Fantasy", retrieved?.style)
    assertEquals("A majestic dragon perched on a mountain", retrieved?.prompt)
  }
}
