use super::*;
use web_sys::{AddEventListenerOptions, MouseEvent, PointerEvent, TouchEvent};

const ACTIONS: &str = "[data-action],[data-tab],[data-view],[data-floor],[data-wall],[data-room],[data-category],[data-close-opening]";
#[derive(PartialEq)]
enum Source { Pointer, Touch }
struct Press { target: Element, id: i32, x: i32, y: i32, cancelled: bool, source: Source }
struct Activation { time: f64, x: i32, y: i32, key: String }
thread_local! {
    static BLOCK_SCENE_CLICK: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
    static PRESS: RefCell<Option<Press>> = const { RefCell::new(None) };
    static LAST_TOUCH: RefCell<Option<Activation>> = const { RefCell::new(None) };
}
fn control(e: &Event) -> Option<Element> {
    let target = e.target()?;
    let element = target.clone().dyn_into::<Element>().ok().or_else(|| target.dyn_into::<web_sys::Node>().ok()?.parent_element())?;
    let result = element.closest(ACTIONS).ok()??;
    if result.has_attribute("disabled") || result.get_attribute("aria-disabled").as_deref() == Some("true") { return None }
    Some(result)
}
fn key(target: &Element) -> String {
    ["data-action","data-tab","data-view","data-floor","data-wall","data-room","data-category","data-close-opening","data-value"].iter()
        .filter_map(|a|target.get_attribute(a).map(|v|format!("{}={}",a,v))).collect::<Vec<_>>().join(";")
}
// Preserve the pressed DOM node through field blur/change. Native iOS touch events
// remain attached to their original target, so replacing it can lose touchend.
pub fn holds(container: &Element) -> bool {
    PRESS.with(|v|v.borrow().as_ref().is_some_and(|p|container.contains(Some(p.target.unchecked_ref()))))
}
fn moved(x: i32,y: i32) {
    PRESS.with(|v|if let Some(p)=v.borrow_mut().as_mut(){if ((x-p.x) as f64).hypot((y-p.y) as f64)>10. {p.cancelled=true;}});
}
fn finish(source: Source,id: i32,x: i32,y: i32,e: &Event) {
    let press=PRESS.with(|v|{if v.borrow().as_ref().is_some_and(|p|p.source==source&&p.id==id){v.borrow_mut().take()}else{None}});
    let Some(p)=press else{return};
    if p.cancelled || ((x-p.x) as f64).hypot((y-p.y) as f64)>10. {render(false);return}
    LAST_TOUCH.with(|v|*v.borrow_mut()=Some(Activation{time:js_sys::Date::now(),x,y,key:key(&p.target)}));
    if e.cancelable(){e.prevent_default()}
    action(p.target);
    // The browser's compatibility click follows the tap once this handler (and any redraw it caused) is done,
    // so the duplicate window starts now; a slow phone redraw can't let it through as a second tap.
    LAST_TOUCH.with(|v|if let Some(a)=v.borrow_mut().as_mut(){a.time=js_sys::Date::now();});
}
fn cancel() {
    let had_press=PRESS.with(|v|v.borrow_mut().take().is_some());
    LAST_TOUCH.with(|v|v.borrow_mut().take());
    if had_press {render(false)}
}
pub fn suppress_scene_click() {
    PRESS.with(|v|v.borrow_mut().take());
    BLOCK_SCENE_CLICK.with(|v|v.set(true));
}
pub fn bind() {
    let click=Closure::<dyn FnMut(Event)>::new(|e:Event|{
        if BLOCK_SCENE_CLICK.with(|v|v.get()) && e.dyn_ref::<MouseEvent>().is_some_and(|m|m.detail()>0) { e.prevent_default();e.stop_immediate_propagation();return }
        let Some(target)=control(&e)else{return};
        let duplicate=e.dyn_ref::<MouseEvent>().is_some_and(|mouse|mouse.detail()>0&&LAST_TOUCH.with(|last|last.borrow().as_ref().is_some_and(|a|{
            js_sys::Date::now()-a.time<900.&&a.key==key(&target)&&(mouse.client_x()-a.x).abs()<=24&&(mouse.client_y()-a.y).abs()<=24
        })));
        e.prevent_default();if duplicate{e.stop_immediate_propagation();return}
        PRESS.with(|v|v.borrow_mut().take());action(target);
    });
    doc().add_event_listener_with_callback_and_bool("click",click.as_ref().unchecked_ref(),true).unwrap();click.forget();

    // Pointer events support pen/desktop and touch implementations with no TouchEvent.
    // TouchEvent takes ownership if both streams are delivered for the same gesture.
    let down=Closure::<dyn FnMut(PointerEvent)>::new(|e:PointerEvent|{
        BLOCK_SCENE_CLICK.with(|v|v.set(false));
        if e.pointer_type()=="mouse"{LAST_TOUCH.with(|v|v.borrow_mut().take());return}
        if !e.is_primary(){cancel();return}
        if PRESS.with(|v|v.borrow().as_ref().is_some_and(|p|p.source==Source::Touch)){return}
        let Some(target)=control(e.unchecked_ref())else{return};LAST_TOUCH.with(|v|v.borrow_mut().take());
        PRESS.with(|v|*v.borrow_mut()=Some(Press{target,id:e.pointer_id(),x:e.client_x(),y:e.client_y(),cancelled:false,source:Source::Pointer}));
    });
    doc().add_event_listener_with_callback_and_bool("pointerdown",down.as_ref().unchecked_ref(),true).unwrap();down.forget();
    let movement=Closure::<dyn FnMut(PointerEvent)>::new(|e:PointerEvent|{
        if PRESS.with(|v|v.borrow().as_ref().is_some_and(|p|p.source==Source::Pointer&&p.id==e.pointer_id())){moved(e.client_x(),e.client_y())}
    });
    doc().add_event_listener_with_callback_and_bool("pointermove",movement.as_ref().unchecked_ref(),true).unwrap();movement.forget();
    let up=Closure::<dyn FnMut(PointerEvent)>::new(|e:PointerEvent|finish(Source::Pointer,e.pointer_id(),e.client_x(),e.client_y(),e.unchecked_ref()));
    doc().add_event_listener_with_callback_and_bool("pointerup",up.as_ref().unchecked_ref(),true).unwrap();up.forget();

    let start=Closure::<dyn FnMut(TouchEvent)>::new(|e:TouchEvent|{
        BLOCK_SCENE_CLICK.with(|v|v.set(false));
        if e.touches().length()!=1{cancel();return}
        let Some(target)=control(e.unchecked_ref())else{return};let Some(t)=e.changed_touches().item(0)else{return};
        LAST_TOUCH.with(|v|v.borrow_mut().take());
        PRESS.with(|v|*v.borrow_mut()=Some(Press{target,id:t.identifier(),x:t.client_x(),y:t.client_y(),cancelled:false,source:Source::Touch}));
    });
    let passive=AddEventListenerOptions::new();passive.set_capture(true);passive.set_passive(true);
    doc().add_event_listener_with_callback_and_add_event_listener_options("touchstart",start.as_ref().unchecked_ref(),&passive).unwrap();start.forget();
    let movement=Closure::<dyn FnMut(TouchEvent)>::new(|e:TouchEvent|{
        if e.touches().length()!=1{cancel();return}
        if let Some(t)=e.touches().item(0){moved(t.client_x(),t.client_y())}
    });
    doc().add_event_listener_with_callback_and_add_event_listener_options("touchmove",movement.as_ref().unchecked_ref(),&passive).unwrap();movement.forget();
    let end=Closure::<dyn FnMut(TouchEvent)>::new(|e:TouchEvent|{for i in 0..e.changed_touches().length(){if let Some(t)=e.changed_touches().item(i){finish(Source::Touch,t.identifier(),t.client_x(),t.client_y(),e.unchecked_ref());}}});
    let active=AddEventListenerOptions::new();active.set_capture(true);active.set_passive(false);
    doc().add_event_listener_with_callback_and_add_event_listener_options("touchend",end.as_ref().unchecked_ref(),&active).unwrap();end.forget();
    let cancelled=Closure::<dyn FnMut(Event)>::new(|e:Event|{
        if e.type_()=="pointercancel"&&PRESS.with(|v|v.borrow().as_ref().is_some_and(|p|p.source==Source::Touch)){return}cancel();
    });
    for name in ["pointercancel","touchcancel"]{doc().add_event_listener_with_callback_and_bool(name,cancelled.as_ref().unchecked_ref(),true).unwrap();}
    web_sys::window().unwrap().add_event_listener_with_callback("blur",cancelled.as_ref().unchecked_ref()).unwrap();cancelled.forget();
}
