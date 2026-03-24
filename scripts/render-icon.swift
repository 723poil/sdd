import AppKit
import Foundation

func color(_ hex: Int, alpha: CGFloat = 1.0) -> NSColor {
  let red = CGFloat((hex >> 16) & 0xff) / 255.0
  let green = CGFloat((hex >> 8) & 0xff) / 255.0
  let blue = CGFloat(hex & 0xff) / 255.0
  return NSColor(calibratedRed: red, green: green, blue: blue, alpha: alpha)
}

guard CommandLine.arguments.count >= 2 else {
  fputs("output path가 필요합니다.\n", stderr)
  exit(1)
}

let outputPath = CommandLine.arguments[1]
let canvasSize = NSSize(width: 1024, height: 1024)
let image = NSImage(size: canvasSize)

image.lockFocus()

guard let context = NSGraphicsContext.current?.cgContext else {
  fputs("그래픽 컨텍스트를 만들 수 없습니다.\n", stderr)
  exit(1)
}

context.setShouldAntialias(true)
context.setAllowsAntialiasing(true)
context.interpolationQuality = .high

let backgroundPath = NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: 1024, height: 1024), xRadius: 240, yRadius: 240)
let backgroundGradient = NSGradient(colors: [color(0x101826), color(0x224653)])!
backgroundGradient.draw(in: backgroundPath, angle: -52)

let glowPath = NSBezierPath(roundedRect: NSRect(x: 48, y: 40, width: 928, height: 944), xRadius: 216, yRadius: 216)
color(0xFFFFFF, alpha: 0.06).setStroke()
glowPath.lineWidth = 10
glowPath.stroke()

context.saveGState()
context.translateBy(x: 0, y: 0)
context.rotate(by: -6 * .pi / 180)
let backCard = NSBezierPath(roundedRect: NSRect(x: 256, y: 266, width: 418, height: 520), xRadius: 96, yRadius: 96)
color(0x79D8CA, alpha: 0.14).setFill()
backCard.fill()
context.restoreGState()

let cardRect = NSRect(x: 278, y: 154, width: 468, height: 640)
let cardPath = NSBezierPath(roundedRect: cardRect, xRadius: 104, yRadius: 104)
let cardGradient = NSGradient(colors: [color(0x6F9793), color(0x5E8482)])!
cardGradient.draw(in: cardPath, angle: -90)

let cardBorder = NSBezierPath(roundedRect: cardRect, xRadius: 104, yRadius: 104)
color(0xFFFFFF, alpha: 0.14).setStroke()
cardBorder.lineWidth = 8
cardBorder.stroke()

let tabPath = NSBezierPath()
tabPath.move(to: NSPoint(x: 640, y: 794))
tabPath.line(to: NSPoint(x: 654, y: 794))
tabPath.curve(to: NSPoint(x: 746, y: 702), controlPoint1: NSPoint(x: 705, y: 794), controlPoint2: NSPoint(x: 746, y: 753))
tabPath.line(to: NSPoint(x: 746, y: 688))
tabPath.close()
let tabGradient = NSGradient(colors: [color(0x8BE2D3), color(0x5FB7EE)])!
tabGradient.draw(in: tabPath, angle: -45)

let topBar = NSBezierPath(roundedRect: NSRect(x: 360, y: 650, width: 206, height: 36), xRadius: 18, yRadius: 18)
color(0xDBF8F1, alpha: 0.72).setFill()
topBar.fill()

let subBar = NSBezierPath(roundedRect: NSRect(x: 360, y: 590, width: 276, height: 26), xRadius: 13, yRadius: 13)
color(0xC0ECE4, alpha: 0.46).setFill()
subBar.fill()

let networkPath = NSBezierPath()
networkPath.move(to: NSPoint(x: 396, y: 470))
networkPath.line(to: NSPoint(x: 624, y: 470))
networkPath.line(to: NSPoint(x: 624, y: 582))
networkPath.line(to: NSPoint(x: 478, y: 716))
let networkGradient = NSGradient(colors: [color(0xFFB07A), color(0xFF7C4A)])!
networkGradient.draw(in: networkPath, relativeCenterPosition: NSPoint.zero)
networkGradient.draw(in: networkPath, angle: -60)

context.saveGState()
networkPath.lineCapStyle = .round
networkPath.lineJoinStyle = .round
networkPath.lineWidth = 84
networkPath.addClip()
networkGradient.draw(in: NSRect(x: 316, y: 402, width: 396, height: 396), angle: -55)
context.restoreGState()

networkPath.lineCapStyle = .round
networkPath.lineJoinStyle = .round
networkPath.lineWidth = 84
color(0xFF905F).setStroke()
networkPath.stroke()

for center in [
  NSPoint(x: 396, y: 470),
  NSPoint(x: 624, y: 470),
  NSPoint(x: 624, y: 582),
  NSPoint(x: 478, y: 716),
] {
  let node = NSBezierPath(ovalIn: NSRect(x: center.x - 56, y: center.y - 56, width: 112, height: 112))
  color(0xFF8758).setFill()
  node.fill()
  color(0x17303B).setStroke()
  node.lineWidth = 24
  node.stroke()
}

image.unlockFocus()

guard
  let tiffData = image.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiffData),
  let pngData = bitmap.representation(using: .png, properties: [:])
else {
  fputs("PNG 데이터를 만들 수 없습니다.\n", stderr)
  exit(1)
}

do {
  try pngData.write(to: URL(fileURLWithPath: outputPath))
} catch {
  fputs("PNG 저장에 실패했습니다.\n", stderr)
  exit(1)
}
