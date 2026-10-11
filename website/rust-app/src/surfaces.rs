use crate::*;

#[derive(Clone,Serialize,Deserialize,Debug)]
#[serde(rename_all="camelCase")]
pub struct TexturePattern { pub name:String, pub data_url:String, pub repeat_feet:f64 }
pub fn tiles()->&'static Value {static T:OnceLock<Value>=OnceLock::new();T.get_or_init(||serde_json::from_str(include_str!("../data/tiles.json")).unwrap())}
pub fn vinyls()->&'static Value{static V:OnceLock<Value>=OnceLock::new();V.get_or_init(||serde_json::from_str(include_str!("../data/vinyl.json")).unwrap())}
pub fn vinyl(name:&str)->Option<&'static Value>{vinyls().as_array()?.iter().find(|v|s(v,"name")==name)}
pub fn tile(name:&str)->Option<&'static Value>{tiles().as_array()?.iter().find(|t|s(t,"name")==name)}
pub fn validate(c:&Config)->Result<(),String>{
 if c.room_wallpapers.len()>256||c.room_wallpapers.iter().any(|(id,p)|id.is_empty()||id.len()>96||!id.bytes().all(|b|b.is_ascii_alphanumeric()||b"-_".contains(&b))||(p!="None"&&!catalog()["wallpapers"].as_array().unwrap().iter().any(|v|s(v,"name")==p))){return Err("Choose a listed wallpaper for each room, with at most 256 room finishes.".into())}
 if c.wall_tiles.iter().any(|(k,v)|!["bedroom","general"].contains(&k.as_str())||(v!="None"&&tile(v).is_none())){return Err("Choose a listed wall tile and a bedroom or rest-of-house group.".into())}
 if c.custom_textures.len()>3{return Err("Use at most three custom textures.".into())}
 for (key,p) in &c.custom_textures{
  let prefix="data:image/jpeg;base64,";
  if !["bedroom","general","floor"].contains(&key.as_str())||p.name.chars().count()>100||p.name.chars().any(char::is_control)||!p.repeat_feet.is_finite()||!(0.25..=16.).contains(&p.repeat_feet)||p.data_url.len()>200_000||!p.data_url.starts_with(prefix){return Err("Custom textures must be a bounded JPEG pattern, repeating every 0.25–16 feet.".into())}
  let encoded=&p.data_url[prefix.len()..];
  if encoded.len()<16||!encoded.starts_with("/9j/")||!encoded.bytes().all(|b|b.is_ascii_alphanumeric()||b"+/=".contains(&b)){return Err("Invalid custom JPEG texture.".into())}
 }
 Ok(())
}
