import React, {useEffect,useRef} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
export default function HouseMap({homes=[],selected,onSelect,onPoint,point}) {
 const node=useRef(null),map=useRef(null),layer=useRef(null),callbacks=useRef({onSelect,onPoint})
 callbacks.current={onSelect,onPoint}
 useEffect(()=>{
  const m=L.map(node.current,{scrollWheelZoom:false}).setView([15.5,101],5);map.current=m
  L.tileLayer(import.meta.env.VITE_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(m)
  layer.current=L.layerGroup().addTo(m)
  m.on('click',e=>callbacks.current.onPoint?.([Number(e.latlng.lat.toFixed(6)),Number(e.latlng.lng.toFixed(6))]))
  const observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(node.current)
  return()=>{observer.disconnect();m.remove();map.current=null}
 },[])
 useEffect(()=>{
  if(!map.current)return
  layer.current.clearLayers()
  const coords=[]
  homes.filter(h=>h.latitude!=null&&h.longitude!=null).forEach(h=>{
   const pos=[Number(h.latitude),Number(h.longitude)];coords.push(pos)
   const label=document.createElement('span');label.textContent=h.name+' (ตำแหน่งโดยประมาณ)'
   L.circleMarker(pos,{radius:selected===h.id?12:8,color:'#315c4a',fillColor:selected===h.id?'#b7853d':'#315c4a',fillOpacity:.85}).bindTooltip(label).on('click',()=>callbacks.current.onSelect?.(h.id)).addTo(layer.current)
  })
  if(point&&point.every(v=>v!==''&&Number.isFinite(Number(v)))){
   L.circleMarker(point.map(Number),{radius:10,color:'#b7853d',fillOpacity:.8}).addTo(layer.current)
  }
  const active=homes.find(h=>h.id===selected&&h.latitude!=null)
  if(active)map.current.setView([Number(active.latitude),Number(active.longitude)],10)
  else if(point&&point.every(v=>v!==''&&Number.isFinite(Number(v))))map.current.setView(point.map(Number),13)
  else if(coords.length)map.current.fitBounds(coords,{padding:[24,24],maxZoom:9})
 },[homes,selected,point])
 return <div ref={node} className="house-map" aria-label={onPoint?'คลิกแผนที่เพื่อระบุที่ตั้งบ้าน':'แผนที่บ้านครอบครัว'}/>
}
