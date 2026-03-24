import AppKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count >= 3 else {
  fputs("input png path와 output icns path가 필요합니다.\n", stderr)
  exit(1)
}

let inputPath = CommandLine.arguments[1]
let outputPath = CommandLine.arguments[2]
let iconSizes: [CGFloat] = [16, 32, 64, 128, 256, 512, 1024]

guard let sourceImage = NSImage(contentsOfFile: inputPath) else {
  fputs("원본 PNG를 읽을 수 없습니다.\n", stderr)
  exit(1)
}

let outputUrl = URL(fileURLWithPath: outputPath)
guard let icnsType = UTType("com.apple.icns") else {
  fputs("icns 타입 식별자를 확인할 수 없습니다.\n", stderr)
  exit(1)
}

guard let destination = CGImageDestinationCreateWithURL(
  outputUrl as CFURL,
  icnsType.identifier as CFString,
  iconSizes.count,
  nil
) else {
  fputs("icns destination을 만들 수 없습니다.\n", stderr)
  exit(1)
}

func makeResizedCgImage(size: CGFloat) -> CGImage? {
  let pixelSize = Int(size)
  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: pixelSize,
    pixelsHigh: pixelSize,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else {
    return nil
  }

  guard let graphicsContext = NSGraphicsContext(bitmapImageRep: bitmap) else {
    return nil
  }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = graphicsContext
  graphicsContext.imageInterpolation = .high
  sourceImage.draw(
    in: NSRect(x: 0, y: 0, width: size, height: size),
    from: NSRect(origin: .zero, size: sourceImage.size),
    operation: .copy,
    fraction: 1.0
  )
  graphicsContext.flushGraphics()
  NSGraphicsContext.restoreGraphicsState()

  return bitmap.cgImage
}

for size in iconSizes {
  guard let cgImage = makeResizedCgImage(size: size) else {
    fputs("크기 \(Int(size)) 이미지를 만들 수 없습니다.\n", stderr)
    exit(1)
  }

  let properties = [
    kCGImagePropertyPixelWidth: Int(size),
    kCGImagePropertyPixelHeight: Int(size),
  ] as CFDictionary

  CGImageDestinationAddImage(destination, cgImage, properties)
}

if !CGImageDestinationFinalize(destination) {
  fputs("icns 저장에 실패했습니다.\n", stderr)
  exit(1)
}
