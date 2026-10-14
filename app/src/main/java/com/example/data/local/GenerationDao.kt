package com.example.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface GenerationDao {
    @Query("SELECT * FROM generations ORDER BY createdAt DESC")
    fun getAllGenerations(): Flow<List<GenerationItem>>

    @Query("SELECT * FROM generations WHERE type = :type ORDER BY createdAt DESC")
    fun getGenerationsByType(type: String): Flow<List<GenerationItem>>

    @Query("SELECT * FROM generations WHERE isFavorite = 1 ORDER BY createdAt DESC")
    fun getFavoriteGenerations(): Flow<List<GenerationItem>>

    @Query("SELECT * FROM generations WHERE id = :id")
    suspend fun getGenerationById(id: Long): GenerationItem?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGeneration(item: GenerationItem): Long

    @Update
    suspend fun updateGeneration(item: GenerationItem)

    @Delete
    suspend fun deleteGeneration(item: GenerationItem)

    @Query("DELETE FROM generations WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("UPDATE generations SET isFavorite = :isFavorite WHERE id = :id")
    suspend fun setFavorite(id: Long, isFavorite: Boolean)
}
