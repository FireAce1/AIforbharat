package com.krishiai.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import com.facebook.react.bridge.*
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.support.common.FileUtil
import org.tensorflow.lite.support.image.ImageProcessor
import org.tensorflow.lite.support.image.TensorImage
import org.tensorflow.lite.support.image.ops.ResizeOp
import org.tensorflow.lite.support.tensorbuffer.TensorBuffer
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

class TFLiteModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private var interpreter: Interpreter? = null
    private var isModelLoaded = false
    private val modelInputSize = 224
    
    override fun getName(): String {
        return "TFLiteModule"
    }
    
    /**
     * Load the TensorFlow Lite model from assets
     */
    @ReactMethod
    fun loadModel(modelPath: String, promise: Promise) {
        try {
            if (isModelLoaded) {
                promise.resolve(true)
                return
            }
            
            val context = reactApplicationContext
            val modelBuffer = FileUtil.loadMappedFile(context, modelPath)
            
            // Configure interpreter options for optimal performance on 2GB RAM devices
            val options = Interpreter.Options().apply {
                setNumThreads(2) // Use 2 threads for better performance
                setUseNNAPI(false) // Disable NNAPI for better compatibility
            }
            
            interpreter = Interpreter(modelBuffer, options)
            isModelLoaded = true
            
            promise.resolve(true)
        } catch (e: Exception) {
            isModelLoaded = false
            promise.reject("MODEL_LOAD_ERROR", "Failed to load model: ${e.message}", e)
        }
    }
    
    /**
     * Run inference on an image
     * @param imageBase64 Base64 encoded image string
     * @param promise Promise to return results
     */
    @ReactMethod
    fun runInference(imageBase64: String, promise: Promise) {
        try {
            if (!isModelLoaded || interpreter == null) {
                promise.reject("MODEL_NOT_LOADED", "Model not loaded. Call loadModel first.")
                return
            }
            
            // Decode base64 image
            val imageBytes = Base64.decode(imageBase64, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            
            if (bitmap == null) {
                promise.reject("IMAGE_DECODE_ERROR", "Failed to decode image")
                return
            }
            
            // Preprocess image
            val inputBuffer = preprocessImage(bitmap)
            
            // Prepare output buffer
            val outputShape = interpreter!!.getOutputTensor(0).shape()
            val numClasses = outputShape[1]
            val outputBuffer = TensorBuffer.createFixedSize(outputShape, org.tensorflow.lite.DataType.FLOAT32)
            
            // Run inference
            val startTime = System.currentTimeMillis()
            interpreter!!.run(inputBuffer, outputBuffer.buffer.rewind())
            val inferenceTime = System.currentTimeMillis() - startTime
            
            // Get results
            val probabilities = outputBuffer.floatArray
            val topResults = getTopKResults(probabilities, 3)
            
            // Create result map
            val resultMap = Arguments.createMap().apply {
                putArray("predictions", topResults)
                putInt("inferenceTime", inferenceTime.toInt())
            }
            
            promise.resolve(resultMap)
            
        } catch (e: Exception) {
            promise.reject("INFERENCE_ERROR", "Inference failed: ${e.message}", e)
        }
    }
    
    /**
     * Preprocess image for model input
     * Resize to 224x224 and normalize to [0,1]
     */
    private fun preprocessImage(bitmap: Bitmap): ByteBuffer {
        // Resize bitmap to model input size
        val resizedBitmap = Bitmap.createScaledBitmap(bitmap, modelInputSize, modelInputSize, true)
        
        // Create ByteBuffer for model input
        val inputBuffer = ByteBuffer.allocateDirect(4 * modelInputSize * modelInputSize * 3)
        inputBuffer.order(ByteOrder.nativeOrder())
        
        // Convert bitmap to normalized float values [0, 1]
        val pixels = IntArray(modelInputSize * modelInputSize)
        resizedBitmap.getPixels(pixels, 0, modelInputSize, 0, 0, modelInputSize, modelInputSize)
        
        for (pixel in pixels) {
            // Extract RGB values and normalize to [0, 1]
            val r = ((pixel shr 16) and 0xFF) / 255.0f
            val g = ((pixel shr 8) and 0xFF) / 255.0f
            val b = (pixel and 0xFF) / 255.0f
            
            inputBuffer.putFloat(r)
            inputBuffer.putFloat(g)
            inputBuffer.putFloat(b)
        }
        
        return inputBuffer
    }
    
    /**
     * Get top K results from probabilities
     */
    private fun getTopKResults(probabilities: FloatArray, k: Int): WritableArray {
        // Create list of (index, probability) pairs
        val results = probabilities.mapIndexed { index, probability ->
            Pair(index, probability)
        }.sortedByDescending { it.second }.take(k)
        
        // Convert to WritableArray
        val resultArray = Arguments.createArray()
        for ((index, probability) in results) {
            val resultMap = Arguments.createMap().apply {
                putInt("classIndex", index)
                putDouble("confidence", probability.toDouble())
            }
            resultArray.pushMap(resultMap)
        }
        
        return resultArray
    }
    
    /**
     * Unload the model and free resources
     */
    @ReactMethod
    fun unloadModel(promise: Promise) {
        try {
            interpreter?.close()
            interpreter = null
            isModelLoaded = false
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UNLOAD_ERROR", "Failed to unload model: ${e.message}", e)
        }
    }
    
    /**
     * Check if model is loaded
     */
    @ReactMethod
    fun isModelLoaded(promise: Promise) {
        promise.resolve(isModelLoaded)
    }
}
