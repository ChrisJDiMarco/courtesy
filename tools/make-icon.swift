import AppKit
let size = 1024
let rep = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:size,pixelsHigh:size,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep:rep)
let square=NSBezierPath(roundedRect:NSRect(x:45,y:45,width:934,height:934),xRadius:204,yRadius:204)
NSGradient(starting:NSColor(red:0.27,green:0.15,blue:0.29,alpha:1),ending:NSColor(red:0.075,green:0.046,blue:0.095,alpha:1))!.draw(in:square,angle:-60)
let border=NSBezierPath(roundedRect:NSRect(x: seventy(),y:seventy(),width:884,height:884),xRadius:183,yRadius:183)
NSColor(red:0.69,green:0.52,blue:0.31,alpha:0.6).setStroke();border.lineWidth=3;border.stroke()
let shadow=NSShadow();shadow.shadowOffset=NSSize(width:0,height:-18);shadow.shadowBlurRadius=20;shadow.shadowColor=NSColor.black.withAlphaComponent(0.5)
for (x,y) in [(350.0,610.0),(674.0,610.0),(512.0,355.0)] {
 NSGraphicsContext.saveGraphicsState();shadow.set()
 let plate=NSBezierPath(ovalIn:NSRect(x:x-139,y:y-113,width:278,height:226))
 NSColor(red:0.83,green:0.78,blue:0.69,alpha:1).setFill();plate.fill();NSGraphicsContext.restoreGraphicsState()
 let rim=NSBezierPath(ovalIn:NSRect(x:x-136,y:y-109,width:272,height:218));NSColor(red:0.87,green:0.71,blue:0.43,alpha:1).setStroke();rim.lineWidth=6;rim.stroke()
 let inset=NSBezierPath(ovalIn:NSRect(x:x-115,y:y-90,width:230,height:180));NSGradient(starting:NSColor(red:0.98,green:0.94,blue:0.86,alpha:1),ending:NSColor(red:0.8,green:0.74,blue:0.65,alpha:1))!.draw(in:inset,angle:90)
 if y < 500 {
  let coin=NSBezierPath(ovalIn:NSRect(x:x-64,y:y-45,width:128,height:107));NSColor(red:0.75,green:0.53,blue:0.23,alpha:1).setFill();coin.fill()
  let top=NSBezierPath(ovalIn:NSRect(x:x-64,y:y-33,width:128,height:107));NSGradient(starting:NSColor(red:0.95,green:0.8,blue:0.46,alpha:1),ending:NSColor(red:0.65,green:0.44,blue:0.19,alpha:1))!.draw(in:top,angle:35)
  let star=NSBezierPath();for i in 0..<16 {let a=Double(i)*Double.pi/8;let r=Double(i%2==0 ? 32:13);let p=NSPoint(x:x+cos(a)*r,y:y+20+sin(a)*r*0.8);if i==0{star.move(to:p)}else{star.line(to:p)}};star.close();NSColor(red:0.36,green:0.21,blue:0.1,alpha:1).setFill();star.fill()
 }
}
let paragraph=NSMutableParagraphStyle();paragraph.alignment = .center
let attrs:[NSAttributedString.Key:Any]=[.font:NSFont(name:"Baskerville-Italic",size:73)!, .foregroundColor:NSColor(red:0.93,green:0.84,blue:0.66,alpha:1),.paragraphStyle:paragraph]
("Courtesy" as NSString).draw(in:NSRect(x:140,y:100,width:744,height:102),withAttributes:attrs)
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"assets/icon-1024.png"))
func seventy()->Double{return 70}
