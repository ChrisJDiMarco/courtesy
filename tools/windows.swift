import CoreGraphics
let windows=CGWindowListCopyWindowInfo([.optionOnScreenOnly,.excludeDesktopElements],kCGNullWindowID) as! [[String:Any]]
for w in windows {let owner=w[kCGWindowOwnerName as String] as? String ?? "";if owner == "Courtesy" || owner == "Electron" {print("\(w[kCGWindowNumber as String]!)\t\(owner)\t\(w[kCGWindowName as String] ?? "")\t\(w[kCGWindowBounds as String] ?? "")")}}
