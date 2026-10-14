package com.example

import com.example.ui.navigation.Screen
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ExampleUnitTest {
  @Test
  fun addition_isCorrect() {
    assertEquals(4, 2 + 2)
  }

  @Test
  fun `verify Screen navItems are non-null and valid`() {
    val items = Screen.navItems
    assertEquals(6, items.size)
    items.forEach { screen ->
      assertNotNull(screen)
      assertTrue(screen.route.isNotBlank())
      assertTrue(screen.title.isNotBlank())
      assertNotNull(screen.icon)
    }
  }
}
