import Cocoa

let width = 1024
let height = 1024

let colorSpace = CGColorSpaceCreateDeviceRGB()
let context = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
)!

// Background gradient
let colors = [
    CGColor(red: 0.1, green: 0.75, blue: 0.55, alpha: 1),
    CGColor(red: 0.05, green: 0.55, blue: 0.45, alpha: 1),
]
let gradient = CGGradient(colorsSpace: colorSpace, colors: colors as CFArray, locations: [0, 1])!

// Rounded rect clip
let path = CGPath(roundedRect: CGRect(x: 0, y: 0, width: width, height: height), cornerWidth: 200, cornerHeight: 200, transform: nil)
context.addPath(path)
context.clip()

context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: 0), end: CGPoint(x: width, y: height), options: [])

// Semi-transparent white circle behind the symbol
context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.2))
context.fillEllipse(in: CGRect(x: 262, y: 262, width: 500, height: 500))

// Outer white circle (coin)
context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.95))
context.fillEllipse(in: CGRect(x: 312, y: 312, width: 400, height: 400))

// Inner circle (coin center - teal)
context.setFillColor(CGColor(red: 0.1, green: 0.75, blue: 0.55, alpha: 1))
context.fillEllipse(in: CGRect(x: 362, y: 362, width: 300, height: 300))

// White "$" in the center
let text = NSAttributedString(
    string: "$",
    attributes: [
        .font: NSFont.systemFont(ofSize: 220, weight: .bold),
        .foregroundColor: NSColor(white: 1, alpha: 0.95)
    ]
)
let textSize = text.size()
let textRect = CGRect(
    x: (CGFloat(width) - textSize.width) / 2,
    y: (CGFloat(height) - textSize.height) / 2 - 10,
    width: textSize.width,
    height: textSize.height
)

let nsContext = NSGraphicsContext(cgContext: context, flipped: false)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = nsContext
text.draw(in: textRect)
NSGraphicsContext.restoreGraphicsState()

let cgImage = context.makeImage()!
let bitmap = NSBitmapImageRep(cgImage: cgImage)
let data = bitmap.representation(using: .png, properties: [:])!

let outputPath = "/Users/cc/对赌项目/cheetah-budget/ios-app/icon_1024.png"
try data.write(to: URL(fileURLWithPath: outputPath))
print("Icon saved: \(outputPath)")
