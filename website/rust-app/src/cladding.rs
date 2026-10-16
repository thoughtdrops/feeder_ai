use crate::*;
// Exterior cladding styles and color swatches. Each cladding type has profile variants that change how it
// looks (reveal, board width, shingle cut, corrugation), all within the same priced allowance, and a short
// list of factory or stain colors that set the cladding color in one click.
pub fn variants(siding:&str)->&'static [&'static str]{match siding{
 "Painted lap siding"=>&["Classic 6 in lap","Narrow 4 in lap","Wide 8 in lap","Dutch lap"],
 "Wood lap siding"=>&["Clear cedar 6 in","Rustic 8 in","Shiplap"],
 "Board & batten siding"=>&["12 in boards · 2 in battens","16 in boards · 3 in battens","Reverse batten"],
 "Vertical timber siding"=>&["Tongue & groove 6 in","Channel groove 8 in","Charred · shou sugi ban"],
 "Cedar shingles"=>&["Straight courses","Staggered butts","Fish-scale"],
 "Horizontal metal"=>&["12 in flush panels","8 in reveal panels"],
 "Corrugated metal"=>&["2-2/3 in corrugation","1-1/4 in mini corrugation"],
 "Standing seam metal"=>&["16 in seams","12 in seams"],
 "Brick veneer"=>&["Natural running bond","Painted brick","Whitewashed brick"],
 "Stone veneer"=>&["Fieldstone","Ledgestone"],
 "Stucco & timber"=>&["Smooth stucco","Sand-float stucco"],
 _=>&[]}}
pub fn swatches(siding:&str)->&'static [(&'static str,&'static str)]{match siding{
 "Painted lap siding"=>&[("Pure white","#f2f0ea"),("Agreeable gray","#cfc8bb"),("Sage","#8e9a84"),("Coastal blue","#7d98a8"),("Navy","#2f3e4e"),("Charcoal","#4a4f52"),("Barn red","#7a2f2a"),("Butter","#e8d8a8")],
 "Wood lap siding"=>&[("Natural cedar","#b98a5e"),("Honey","#c99a62"),("Walnut stain","#6b4a33"),("Weathered gray","#9a958a"),("Ebony stain","#3a3330")],
 "Board & batten siding"=>&[("White","#f4f3ef"),("Black","#26282a"),("Greige","#bdb4a5"),("Sage","#7f8c76"),("Slate blue","#566878"),("Barn red","#7a2f2a")],
 "Vertical timber siding"=>&[("Natural","#b58a5c"),("Smoked","#7a5a40"),("Silvered","#a7a299"),("Charred","#2b2622")],
 "Cedar shingles"=>&[("Natural cedar","#b78a5e"),("Weathered gray","#a3a39a"),("White","#ece8de"),("Sage","#88947f"),("Navy","#3a4a5c")],
 "Horizontal metal"=>&[("Charcoal","#3d4144"),("Bronze","#5a4a3a"),("Silver","#b9bcbd"),("Black","#202224"),("White","#e9e9e6")],
 "Corrugated metal"=>&[("Galvalume","#c2c5c6"),("Rust","#8a4b2c"),("Charcoal","#3d4144"),("Barn red","#7c2e28")],
 "Standing seam metal"=>&[("Charcoal","#3d4144"),("Bronze","#5a4a3a"),("Silver","#b9bcbd"),("Black","#202224"),("Forest green","#2f4a3a"),("White","#e9e9e6")],
 "Brick veneer"=>&[("Natural","#ffffff"),("Warm","#f0d8c8"),("Painted white","#f2f0ea"),("Greige","#c9bfb0"),("Painted black","#2a2b2d")],
 "Stone veneer"=>&[("Natural","#ffffff"),("Warm","#efe2cf"),("Cool gray","#cfd3d6"),("Charcoal","#7a7d80")],
 "Stucco & timber"=>&[("White","#f1ede4"),("Sand","#d9c8a8"),("Terracotta","#c78f6a"),("Gray","#bdbab3"),("Cream","#efe3c8")],
 _=>&[]}}
/// The variant in effect: the visitor's pick when it belongs to the current cladding, else the first.
pub fn variant(c:&Config)->&'static str{let v=variants(&c.siding);v.iter().copied().find(|n|*n==c.cladding_variant).or(v.first().copied()).unwrap_or("")}
pub fn valid(c:&Config)->bool{c.cladding_variant.is_empty()||variants(&c.siding).contains(&c.cladding_variant.as_str())}
