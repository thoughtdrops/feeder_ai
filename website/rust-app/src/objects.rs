use crate::*;
#[derive(Deserialize)]pub struct Object{pub kind:String,pub name:String,pub group:String,pub width:f64,pub depth:f64,pub price:f64}
pub fn all()->&'static Vec<Object>{static O:OnceLock<Vec<Object>>=OnceLock::new();O.get_or_init(||serde_json::from_str(include_str!("../data/objects.json")).unwrap())}
pub fn find(kind:&str)->Option<&'static Object>{all().iter().find(|o|o.kind==kind)}
