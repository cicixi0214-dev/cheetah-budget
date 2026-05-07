import Cocoa

let width = 1024
let height = 1024

let colorSpace = CGColorSpaceCreateDeviceRGB()
let mainContext = CGContext(
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

let path = CGPath(roundedRect: CGRect(x: 0, y: 0, width: width, height: height), cornerWidth: 200, cornerHeight: 200, transform: nil)
mainContext.addPath(path)
mainContext.clip()
mainContext.drawLinearGradient(gradient, start: CGPoint(x: 0, y: 0), end: CGPoint(x: width, y: height), options: [])

mainContext.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.2))
mainContext.fillEllipse(in: CGRect(x: 262, y: 262, width: 500, height: 500))

mainContext.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.95))
mainContext.fillEllipse(in: CGRect(x: 312, y: 312, width: 400, height: 400))

mainContext.setFillColor(CGColor(red: 0.1, green: 0.75, blue: 0.55, alpha: 1))
mainContext.fillEllipse(in: CGRect(x: 362, y: 362, width: 300, height: 300))

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

let nsContext = NSGraphicsContext(cgContext: mainContext, flipped: false)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = nsContext
text.draw(in: textRect)
NSGraphicsContext.restoreGraphicsState()

let cgImage = mainContext.makeImage()!

func resize(_ image: CGImage, to size: Int) -> CGImage {
    let ctx = CGContext(
        data: nil,
        width: size,
        height: size,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: 1
    )!
    ctx.interpolationQuality = CGInterpolationQuality.high
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
    return ctx.makeImage()!
}

func savePNG(_ image: CGImage, path: String) {
    let bitmap = NSBitmapImageRep(cgImage: image)
    try! bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

let sizes = [1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20]
let base = "/Users/cc/对赌项目/cheetah-budget/ios-app/Centsnap/Assets.xcassets/AppIcon.appiconset"

for s in sizes {
    let resized = resize(cgImage, to: s)
    savePNG(resized, path: "\(base)/icon_\(s).png")
    print("  \(s)x\(s) done")
}

print("All icons generated!")
