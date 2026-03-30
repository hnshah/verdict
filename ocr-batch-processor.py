#!/usr/bin/env python3
"""
OCR Batch Processor

Process multiple PDFs/images in parallel using LightOn OCR-2-1B.
Supports: documents, receipts, invoices, scientific papers.
NOT suitable for: handwriting, photos.

Based on benchmarks:
- Receipt: 7.6s, 10/10 quality
- Invoice: 19.0s, 10/10 quality
- Scientific paper: 28.5s/page, 9/10 quality
- Multi-page: 25.1s/page average, 144 pages/hour
"""

import argparse
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from concurrent.futures import ProcessPoolExecutor, as_completed
import torch
from transformers import LightOnOcrForConditionalGeneration, LightOnOcrProcessor
import pypdfium2 as pdfium
from PIL import Image


class OCRBatchProcessor:
    """Batch OCR processor using LightOn OCR-2-1B"""
    
    def __init__(self, device: str = "mps", max_workers: int = 1):
        """
        Initialize OCR processor.
        
        Args:
            device: 'mps', 'cuda', or 'cpu'
            max_workers: Number of parallel workers (default 1 for sequential)
        """
        self.device = device
        self.max_workers = max_workers
        self.dtype = torch.float32 if device == "mps" else torch.bfloat16
        
        print(f"🔧 Initializing OCR processor...")
        print(f"   Device: {device}")
        print(f"   Workers: {max_workers}")
        
        # Load model once
        self.model = LightOnOcrForConditionalGeneration.from_pretrained(
            "lightonai/LightOnOCR-2-1B",
            torch_dtype=self.dtype
        ).to(device)
        
        self.processor = LightOnOcrProcessor.from_pretrained(
            "lightonai/LightOnOCR-2-1B"
        )
        
        print(f"✅ Model loaded\n")
    
    def process_image(self, image_path: Path) -> Dict[str, Any]:
        """Process single image file"""
        start = time.time()
        
        try:
            # Load image
            image = Image.open(image_path)
            
            # OCR
            conversation = [{"role": "user", "content": [{"type": "image", "image": image}]}]
            inputs = self.processor.apply_chat_template(
                conversation,
                add_generation_prompt=True,
                tokenize=True,
                return_dict=True,
                return_tensors="pt",
            )
            inputs = {
                k: v.to(device=self.device, dtype=self.dtype) if v.is_floating_point() else v.to(self.device)
                for k, v in inputs.items()
            }
            
            output_ids = self.model.generate(**inputs, max_new_tokens=4096)
            generated_ids = output_ids[0, inputs["input_ids"].shape[1]:]
            text = self.processor.decode(generated_ids, skip_special_tokens=True)
            
            elapsed = time.time() - start
            
            return {
                "path": str(image_path),
                "type": "image",
                "text": text,
                "chars": len(text),
                "time_seconds": elapsed,
                "success": True,
            }
        
        except Exception as e:
            return {
                "path": str(image_path),
                "type": "image",
                "success": False,
                "error": str(e),
                "time_seconds": time.time() - start,
            }
    
    def process_pdf(self, pdf_path: Path, max_pages: Optional[int] = None) -> Dict[str, Any]:
        """Process PDF (all pages or up to max_pages)"""
        start = time.time()
        
        try:
            # Open PDF
            pdf_data = pdf_path.read_bytes()
            pdf = pdfium.PdfDocument(pdf_data)
            num_pages = len(pdf)
            
            pages_to_process = min(num_pages, max_pages) if max_pages else num_pages
            
            # Process each page
            pages = []
            total_chars = 0
            
            for page_num in range(pages_to_process):
                page_start = time.time()
                
                # Render page at 200 DPI
                page = pdf[page_num]
                pil_image = page.render(scale=2.77).to_pil()
                
                # OCR
                conversation = [{"role": "user", "content": [{"type": "image", "image": pil_image}]}]
                inputs = self.processor.apply_chat_template(
                    conversation,
                    add_generation_prompt=True,
                    tokenize=True,
                    return_dict=True,
                    return_tensors="pt",
                )
                inputs = {
                    k: v.to(device=self.device, dtype=self.dtype) if v.is_floating_point() else v.to(self.device)
                    for k, v in inputs.items()
                }
                
                output_ids = self.model.generate(**inputs, max_new_tokens=4096)
                generated_ids = output_ids[0, inputs["input_ids"].shape[1]:]
                text = self.processor.decode(generated_ids, skip_special_tokens=True)
                
                page_elapsed = time.time() - page_start
                
                pages.append({
                    "page": page_num + 1,
                    "text": text,
                    "chars": len(text),
                    "time_seconds": page_elapsed,
                })
                
                total_chars += len(text)
            
            elapsed = time.time() - start
            
            return {
                "path": str(pdf_path),
                "type": "pdf",
                "pages": pages,
                "total_pages": num_pages,
                "processed_pages": pages_to_process,
                "total_chars": total_chars,
                "time_seconds": elapsed,
                "avg_time_per_page": elapsed / pages_to_process if pages_to_process > 0 else 0,
                "success": True,
            }
        
        except Exception as e:
            return {
                "path": str(pdf_path),
                "type": "pdf",
                "success": False,
                "error": str(e),
                "time_seconds": time.time() - start,
            }
    
    def process_batch(
        self,
        files: List[Path],
        max_pdf_pages: Optional[int] = None,
        output_dir: Optional[Path] = None,
    ) -> Dict[str, Any]:
        """
        Process batch of files.
        
        Args:
            files: List of image/PDF paths
            max_pdf_pages: Max pages to process per PDF
            output_dir: Optional directory to save individual results
        
        Returns:
            Summary with all results
        """
        print(f"📦 Processing {len(files)} file(s)...\n")
        
        results = []
        start_time = time.time()
        
        # Process sequentially for now (parallel with multiprocessing later)
        for i, file_path in enumerate(files, 1):
            print(f"[{i}/{len(files)}] Processing: {file_path.name}")
            
            if file_path.suffix.lower() == '.pdf':
                result = self.process_pdf(file_path, max_pdf_pages)
            else:
                result = self.process_image(file_path)
            
            results.append(result)
            
            if result["success"]:
                if result["type"] == "pdf":
                    pages = result["processed_pages"]
                    chars = result["total_chars"]
                    time_s = result["time_seconds"]
                    print(f"   ✅ {pages} pages, {chars} chars, {time_s:.1f}s ({time_s/pages:.1f}s/page)")
                else:
                    chars = result["chars"]
                    time_s = result["time_seconds"]
                    print(f"   ✅ {chars} chars, {time_s:.1f}s")
            else:
                print(f"   ❌ Failed: {result.get('error', 'Unknown error')}")
            
            # Save individual result if output_dir provided
            if output_dir:
                output_file = output_dir / f"{file_path.stem}_ocr.json"
                output_file.write_text(json.dumps(result, indent=2))
            
            print()
        
        total_time = time.time() - start_time
        
        # Summary
        successful = [r for r in results if r["success"]]
        failed = [r for r in results if not r["success"]]
        
        total_pages = sum(
            r.get("processed_pages", 1) for r in successful
        )
        total_chars = sum(
            r.get("total_chars", r.get("chars", 0)) for r in successful
        )
        
        summary = {
            "total_files": len(files),
            "successful": len(successful),
            "failed": len(failed),
            "total_pages": total_pages,
            "total_chars": total_chars,
            "total_time_seconds": total_time,
            "avg_time_per_file": total_time / len(files) if files else 0,
            "avg_time_per_page": total_time / total_pages if total_pages > 0 else 0,
            "throughput_pages_per_hour": (total_pages / total_time * 3600) if total_time > 0 else 0,
            "results": results,
        }
        
        return summary


def main():
    parser = argparse.ArgumentParser(
        description="Batch OCR processing using LightOn OCR-2-1B",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process single PDF
  python ocr-batch-processor.py paper.pdf
  
  # Process all PDFs in directory
  python ocr-batch-processor.py papers/*.pdf
  
  # Process with page limit
  python ocr-batch-processor.py --max-pages 5 *.pdf
  
  # Save results to directory
  python ocr-batch-processor.py -o output/ receipts/*.jpg
  
  # Process images and PDFs together
  python ocr-batch-processor.py images/*.png docs/*.pdf
        """,
    )
    
    parser.add_argument(
        "files",
        nargs="+",
        type=Path,
        help="Image or PDF files to process",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        help="Max pages to process per PDF",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Output directory for individual JSON results",
    )
    parser.add_argument(
        "--device",
        choices=["mps", "cuda", "cpu"],
        default="mps",
        help="Device to use (default: mps)",
    )
    parser.add_argument(
        "--summary",
        type=Path,
        help="Save summary JSON to file",
    )
    
    args = parser.parse_args()
    
    # Create output directory if specified
    if args.output:
        args.output.mkdir(parents=True, exist_ok=True)
    
    # Initialize processor
    processor = OCRBatchProcessor(device=args.device)
    
    # Process batch
    summary = processor.process_batch(
        files=args.files,
        max_pdf_pages=args.max_pages,
        output_dir=args.output,
    )
    
    # Print summary
    print("=" * 70)
    print("📊 BATCH SUMMARY")
    print("=" * 70)
    print()
    print(f"Files processed: {summary['successful']}/{summary['total_files']}")
    print(f"Total pages: {summary['total_pages']}")
    print(f"Total chars: {summary['total_chars']:,}")
    print(f"Total time: {summary['total_time_seconds']:.1f}s")
    print(f"Avg time/page: {summary['avg_time_per_page']:.1f}s")
    print(f"Throughput: {summary['throughput_pages_per_hour']:.0f} pages/hour")
    
    if summary['failed'] > 0:
        print(f"\n⚠️  Failed: {summary['failed']} files")
    
    # Save summary if requested
    if args.summary:
        args.summary.write_text(json.dumps(summary, indent=2))
        print(f"\n💾 Summary saved to: {args.summary}")


if __name__ == "__main__":
    main()
