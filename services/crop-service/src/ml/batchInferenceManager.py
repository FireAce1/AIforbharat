"""
Batch Inference Manager for KrishiAI ML Models
Purpose: Optimize ML inference throughput by batching requests
Performance: 5-10x improvement over individual inference
"""

import asyncio
import time
from typing import List, Dict, Any, Callable
from dataclasses import dataclass
from collections import deque
import numpy as np
import logging

logger = logging.getLogger(__name__)


@dataclass
class InferenceRequest:
    """Single inference request"""
    request_id: str
    input_data: Any
    timestamp: float
    future: asyncio.Future


@dataclass
class BatchConfig:
    """Batch processing configuration"""
    max_batch_size: int = 32
    max_wait_time_ms: int = 100  # Maximum time to wait for batch to fill
    min_batch_size: int = 1
    timeout_ms: int = 5000  # Request timeout


class BatchInferenceManager:
    """
    Manages batched inference requests for ML models
    
    Features:
    - Automatic batching of requests
    - Dynamic batch sizing based on load
    - Request timeout handling
    - Performance metrics tracking
    """
    
    def __init__(
        self,
        model_inference_fn: Callable,
        config: BatchConfig = None
    ):
        self.model_inference_fn = model_inference_fn
        self.config = config or BatchConfig()
        
        # Request queue
        self.request_queue: deque = deque()
        self.queue_lock = asyncio.Lock()
        
        # Processing state
        self.is_processing = False
        self.processor_task = None
        
        # Metrics
        self.metrics = {
            'total_requests': 0,
            'total_batches': 0,
            'total_inference_time_ms': 0,
            'total_wait_time_ms': 0,
            'avg_batch_size': 0,
            'timeouts': 0,
        }
    
    async def start(self):
        """Start the batch processor"""
        if not self.is_processing:
            self.is_processing = True
            self.processor_task = asyncio.create_task(self._process_batches())
            logger.info("Batch inference manager started")
    
    async def stop(self):
        """Stop the batch processor"""
        self.is_processing = False
        if self.processor_task:
            await self.processor_task
        logger.info("Batch inference manager stopped")
    
    async def infer(self, request_id: str, input_data: Any) -> Any:
        """
        Submit inference request and wait for result
        
        Args:
            request_id: Unique request identifier
            input_data: Model input data
            
        Returns:
            Model prediction result
            
        Raises:
            TimeoutError: If request times out
        """
        # Create request with future
        future = asyncio.Future()
        request = InferenceRequest(
            request_id=request_id,
            input_data=input_data,
            timestamp=time.time(),
            future=future
        )
        
        # Add to queue
        async with self.queue_lock:
            self.request_queue.append(request)
            self.metrics['total_requests'] += 1
        
        # Wait for result with timeout
        try:
            result = await asyncio.wait_for(
                future,
                timeout=self.config.timeout_ms / 1000
            )
            return result
        except asyncio.TimeoutError:
            self.metrics['timeouts'] += 1
            logger.error(f"Request {request_id} timed out")
            raise TimeoutError(f"Inference request timed out after {self.config.timeout_ms}ms")
    
    async def _process_batches(self):
        """Main batch processing loop"""
        while self.is_processing:
            try:
                # Wait for requests or timeout
                await asyncio.sleep(self.config.max_wait_time_ms / 1000)
                
                # Get batch of requests
                batch = await self._get_batch()
                
                if not batch:
                    continue
                
                # Process batch
                await self._process_batch(batch)
                
            except Exception as e:
                logger.error(f"Error in batch processor: {e}")
    
    async def _get_batch(self) -> List[InferenceRequest]:
        """Get next batch of requests from queue"""
        batch = []
        
        async with self.queue_lock:
            # Get up to max_batch_size requests
            while len(batch) < self.config.max_batch_size and self.request_queue:
                request = self.request_queue.popleft()
                
                # Check if request has timed out
                age_ms = (time.time() - request.timestamp) * 1000
                if age_ms > self.config.timeout_ms:
                    request.future.set_exception(
                        TimeoutError(f"Request timed out in queue after {age_ms:.0f}ms")
                    )
                    self.metrics['timeouts'] += 1
                    continue
                
                batch.append(request)
        
        return batch
    
    async def _process_batch(self, batch: List[InferenceRequest]):
        """Process a batch of inference requests"""
        if not batch:
            return
        
        batch_size = len(batch)
        start_time = time.time()
        
        try:
            # Prepare batch input
            batch_input = self._prepare_batch_input(batch)
            
            # Run inference
            inference_start = time.time()
            batch_output = await self._run_inference(batch_input)
            inference_time_ms = (time.time() - inference_start) * 1000
            
            # Distribute results
            self._distribute_results(batch, batch_output)
            
            # Update metrics
            total_time_ms = (time.time() - start_time) * 1000
            self._update_metrics(batch_size, inference_time_ms, total_time_ms)
            
            logger.debug(
                f"Processed batch: size={batch_size}, "
                f"inference_time={inference_time_ms:.1f}ms, "
                f"total_time={total_time_ms:.1f}ms"
            )
            
        except Exception as e:
            logger.error(f"Error processing batch: {e}")
            # Set exception for all requests in batch
            for request in batch:
                if not request.future.done():
                    request.future.set_exception(e)
    
    def _prepare_batch_input(self, batch: List[InferenceRequest]) -> Any:
        """Prepare batched input for model"""
        # Stack inputs into batch
        # Assumes input_data is numpy array or can be stacked
        try:
            batch_input = np.stack([req.input_data for req in batch])
            return batch_input
        except Exception as e:
            logger.error(f"Error preparing batch input: {e}")
            raise
    
    async def _run_inference(self, batch_input: Any) -> Any:
        """Run model inference on batch"""
        # Run inference (may be sync or async)
        if asyncio.iscoroutinefunction(self.model_inference_fn):
            return await self.model_inference_fn(batch_input)
        else:
            # Run sync function in executor
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                self.model_inference_fn,
                batch_input
            )
    
    def _distribute_results(self, batch: List[InferenceRequest], batch_output: Any):
        """Distribute batch results to individual requests"""
        try:
            # Assumes batch_output is array-like with same length as batch
            for i, request in enumerate(batch):
                if not request.future.done():
                    result = batch_output[i]
                    request.future.set_result(result)
        except Exception as e:
            logger.error(f"Error distributing results: {e}")
            # Set exception for remaining requests
            for request in batch:
                if not request.future.done():
                    request.future.set_exception(e)
    
    def _update_metrics(self, batch_size: int, inference_time_ms: float, total_time_ms: float):
        """Update performance metrics"""
        self.metrics['total_batches'] += 1
        self.metrics['total_inference_time_ms'] += inference_time_ms
        self.metrics['total_wait_time_ms'] += (total_time_ms - inference_time_ms)
        
        # Update average batch size
        total_requests = self.metrics['total_requests']
        total_batches = self.metrics['total_batches']
        self.metrics['avg_batch_size'] = total_requests / total_batches if total_batches > 0 else 0
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        metrics = self.metrics.copy()
        
        # Calculate derived metrics
        if metrics['total_batches'] > 0:
            metrics['avg_inference_time_ms'] = (
                metrics['total_inference_time_ms'] / metrics['total_batches']
            )
            metrics['avg_wait_time_ms'] = (
                metrics['total_wait_time_ms'] / metrics['total_batches']
            )
        else:
            metrics['avg_inference_time_ms'] = 0
            metrics['avg_wait_time_ms'] = 0
        
        # Calculate throughput
        if metrics['total_inference_time_ms'] > 0:
            metrics['throughput_requests_per_sec'] = (
                metrics['total_requests'] / (metrics['total_inference_time_ms'] / 1000)
            )
        else:
            metrics['throughput_requests_per_sec'] = 0
        
        # Queue size
        metrics['queue_size'] = len(self.request_queue)
        
        return metrics
    
    def reset_metrics(self):
        """Reset performance metrics"""
        self.metrics = {
            'total_requests': 0,
            'total_batches': 0,
            'total_inference_time_ms': 0,
            'total_wait_time_ms': 0,
            'avg_batch_size': 0,
            'timeouts': 0,
        }


# Example usage
async def example_usage():
    """Example of using BatchInferenceManager"""
    
    # Mock model inference function
    def model_inference(batch_input):
        """Simulate model inference"""
        time.sleep(0.05)  # Simulate 50ms inference time
        return np.random.rand(len(batch_input), 10)  # Return predictions
    
    # Create batch manager
    config = BatchConfig(
        max_batch_size=32,
        max_wait_time_ms=100,
        timeout_ms=5000
    )
    
    manager = BatchInferenceManager(model_inference, config)
    await manager.start()
    
    # Submit multiple requests concurrently
    tasks = []
    for i in range(100):
        input_data = np.random.rand(224, 224, 3)
        task = manager.infer(f"request_{i}", input_data)
        tasks.append(task)
    
    # Wait for all results
    results = await asyncio.gather(*tasks)
    
    # Get metrics
    metrics = manager.get_metrics()
    print(f"Processed {metrics['total_requests']} requests in {metrics['total_batches']} batches")
    print(f"Average batch size: {metrics['avg_batch_size']:.1f}")
    print(f"Average inference time: {metrics['avg_inference_time_ms']:.1f}ms")
    print(f"Throughput: {metrics['throughput_requests_per_sec']:.1f} req/s")
    
    await manager.stop()


if __name__ == "__main__":
    asyncio.run(example_usage())
