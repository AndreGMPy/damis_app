'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Search, ShoppingCart, Trash2, CheckCircle2, ArrowLeft, Wifi, WifiOff, CloudOff } from 'lucide-react'
import Link from 'next/link'

interface Producto {
    id: number
    nombre: string
    precio_venta: number
    stock: number
}

interface VentaRegistrada {
    id: number | string // Puede ser string si es un ID temporal generado offline
    created_at: string
    cantidad: number
    total: number
    producto_id: number
    Inventario?: { nombre: string }
    nombre_offline?: string // Para mostrar el nombre cuando estamos sin internet
    offline?: boolean // Bandera para saber si es un ticket no sincronizado
}

interface ItemCarrito {
    producto_id: number
    nombre: string
    cantidad: number
    precio: number
    subtotal: number
    stock_disponible: number
}

export default function VentasPage() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [busquedaPOS, setBusquedaPOS] = useState('')
    const [ventas, setVentas] = useState<VentaRegistrada[]>([])
    const [loading, setLoading] = useState(true)

    // ESTADOS OFFLINE
    const [isOnline, setIsOnline] = useState(true)
    const [ventasPendientesCount, setVentasPendientesCount] = useState(0)

    const [carrito, setCarrito] = useState<ItemCarrito[]>([])
    const [productoSeleccionadoId, setProductoSeleccionadoId] = useState('')
    const [cantidad, setCantidad] = useState('1')
    const [cobrando, setCobrando] = useState(false)
    const [toast, setToast] = useState({ visible: false, mensaje: '' })

    const mostrarToast = (mensaje: string) => {
        setToast({ visible: true, mensaje })
        setTimeout(() => setToast({ visible: false, mensaje: '' }), 3000)
    }

    // SENSOR DE INTERNET
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsOnline(navigator.onLine)

            const handleOnline = () => setIsOnline(true)
            const handleOffline = () => setIsOnline(false)

            window.addEventListener('online', handleOnline)
            window.addEventListener('offline', handleOffline)

            return () => {
                window.removeEventListener('online', handleOnline)
                window.removeEventListener('offline', handleOffline)
            }
        }
    }, [])

    // CARGA DE DATOS (HÍBRIDA)
    const cargarDatos = async () => {
        setLoading(true)

        // 1. Cargar catálogo de productos
        if (navigator.onLine) {
            // ONLINE: Bajar de Supabase y guardar un respaldo en el celular
            const { data: prodData } = await supabase.from('Inventario').select('*').order('nombre', { ascending: true })
            if (prodData) {
                setProductos(prodData)
                localStorage.setItem('inventario_cache', JSON.stringify(prodData))
            }
        } else {
            // OFFLINE: Leer el respaldo de la memoria del celular
            const cache = localStorage.getItem('inventario_cache')
            if (cache) setProductos(JSON.parse(cache))
        }

        // 2. Cargar historial de ventas de hoy y pendientes
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        let ventasMostradas: VentaRegistrada[] = []

        if (navigator.onLine) {
            const { data: ventData } = await supabase
                .from('Ventas')
                .select('id, created_at, cantidad, total, producto_id, Inventario(nombre)')
                .gte('created_at', hoy.toISOString())
                .order('created_at', { ascending: false })

            if (ventData) ventasMostradas = ventData as unknown as VentaRegistrada[]
        }

        // Sumar visualmente las ventas pendientes que están atoradas sin internet
        const pendientesGuardadas = JSON.parse(localStorage.getItem('ventas_pendientes') || '[]')
        setVentasPendientesCount(pendientesGuardadas.length)

        // Convertir el formato del carrito pendiente para que se vea en la tabla
        const ventasOfflineParaTabla = pendientesGuardadas.flatMap((ticket: any) =>
            ticket.items.map((item: any) => ({
                id: `offline-${Date.now()}-${Math.random()}`,
                created_at: ticket.fecha,
                cantidad: item.cantidad,
                total: item.subtotal,
                producto_id: item.producto_id,
                nombre_offline: item.nombre,
                offline: true
            }))
        )

        setVentas([...ventasOfflineParaTabla, ...ventasMostradas])
        setLoading(false)
    }

    useEffect(() => { cargarDatos() }, [isOnline])

    const productosFiltradosParaSelect = productos.filter(p =>
        p.nombre.toLowerCase().includes(busquedaPOS.toLowerCase())
    )

    const handleAgregarAlCarrito = (e: React.FormEvent) => {
        e.preventDefault()
        const prodId = parseInt(productoSeleccionadoId)
        const cant = parseInt(cantidad)
        if (!prodId || !cant || cant <= 0) return

        const productoDb = productos.find(p => p.id === prodId)
        if (!productoDb) return

        const itemExistente = carrito.find(item => item.producto_id === prodId)
        const cantidadTotalProyectada = itemExistente ? itemExistente.cantidad + cant : cant

        if (productoDb.stock < cantidadTotalProyectada) {
            alert(`¡Stock insuficiente! Solo quedan ${productoDb.stock} pzs de ${productoDb.nombre}.`)
            return
        }

        if (itemExistente) {
            setCarrito(carrito.map(item =>
                item.producto_id === prodId
                    ? { ...item, cantidad: item.cantidad + cant, subtotal: (item.cantidad + cant) * item.precio }
                    : item
            ))
        } else {
            setCarrito([{
                producto_id: prodId,
                nombre: productoDb.nombre,
                cantidad: cant,
                precio: productoDb.precio_venta,
                subtotal: cant * productoDb.precio_venta,
                stock_disponible: productoDb.stock
            }, ...carrito])
        }

        setProductoSeleccionadoId('')
        setCantidad('1')
        setBusquedaPOS('')
    }

    const quitarDelCarrito = (id: number) => {
        setCarrito(carrito.filter(item => item.producto_id !== id))
    }

    const totalCarrito = carrito.reduce((acc, item) => acc + item.subtotal, 0)

    // EL CEREBRO DE LA VENTA (DECIDE SI VA A NUBE O CACHÉ)
    const handleCobrar = async () => {
        if (carrito.length === 0) return
        setCobrando(true)

        if (isOnline) {
            // MODO ONLINE (Como antes)
            const nuevasVentas = carrito.map(item => ({
                producto_id: item.producto_id,
                cantidad: item.cantidad,
                total: item.subtotal
            }))
            await supabase.from('Ventas').insert(nuevasVentas)
            for (const item of carrito) {
                await supabase.from('Inventario').update({ stock: item.stock_disponible - item.cantidad }).eq('id', item.producto_id)
            }
            mostrarToast('✨ ¡Venta cobrada y sincronizada!')
        } else {
            // MODO OFFLINE (Caja Fuerte Local)
            const ticketPendiente = {
                id_local: Date.now(),
                fecha: new Date().toISOString(),
                items: carrito
            }

            const pendientes = JSON.parse(localStorage.getItem('ventas_pendientes') || '[]')
            pendientes.push(ticketPendiente)
            localStorage.setItem('ventas_pendientes', JSON.stringify(pendientes))

            // Actualizar el stock del caché local para que no siga vendiendo lo que ya no hay
            const cacheActual = JSON.parse(localStorage.getItem('inventario_cache') || '[]')
            const nuevoCache = cacheActual.map((p: Producto) => {
                const itemVendido = carrito.find(c => c.producto_id === p.id)
                if (itemVendido) return { ...p, stock: p.stock - itemVendido.cantidad }
                return p
            })
            localStorage.setItem('inventario_cache', JSON.stringify(nuevoCache))
            setProductos(nuevoCache)

            mostrarToast('💾 Guardado localmente (Sin Internet)')
        }

        setCarrito([])
        cargarDatos()
        setCobrando(false)
    }

    const handleEliminarVenta = async (venta: VentaRegistrada) => {
        if (venta.offline) {
            alert("Para cancelar una venta hecha sin internet, debes esperar a sincronizar el sistema primero.")
            return
        }

        if (!window.confirm(`¿Cancelar venta de ${venta.cantidad} pzs de ${venta.Inventario?.nombre}?`)) return

        if (isOnline) {
            await supabase.from('Ventas').delete().eq('id', venta.id)
            const productoReal = productos.find(p => p.id === venta.producto_id)
            if (productoReal) {
                await supabase.from('Inventario').update({ stock: productoReal.stock + venta.cantidad }).eq('id', venta.producto_id)
            }
            cargarDatos()
            mostrarToast('🗑️ Venta cancelada y stock restaurado.')
        } else {
            alert("Necesitas conexión a internet para cancelar ventas en la base de datos central.")
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 relative overflow-hidden animate-in fade-in duration-500">

            <div className="flex justify-between items-center">
                <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-semibold bg-primary/10 hover:bg-primary/20 px-4 py-2.5 rounded-2xl w-fit">
                    <ArrowLeft size={18} />
                    Regresar al Panel
                </Link>

                {/* INDICADOR DE RED Y CACHÉ */}
                <div className="flex items-center gap-3">
                    {ventasPendientesCount > 0 && (
                        <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-sm font-bold animate-pulse">
                            <CloudOff size={16} />
                            {ventasPendientesCount} tickets sin subir
                        </div>
                    )}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold ${isOnline ? 'bg-green-100 text-green-700' : 'bg-destructive/10 text-destructive'}`}>
                        {isOnline ? <><Wifi size={16} /> En línea</> : <><WifiOff size={16} /> Modo Offline</>}
                    </div>
                </div>
            </div>

            <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out transform ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className="bg-primary text-white px-6 py-4 rounded-2xl shadow-xl font-medium flex items-center gap-3">
                    <CheckCircle2 size={20} /> {toast.mensaje}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* FORMULARIO Y CARRITO */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className="p-6 rounded-3xl shadow-sm border-border/50 bg-white">
                        <h2 className="text-xl font-bold text-foreground mb-4">Añadir Producto</h2>

                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/50" size={18} />
                            <Input
                                placeholder="Escribe para buscar..."
                                value={busquedaPOS}
                                onChange={(e) => setBusquedaPOS(e.target.value)}
                                className="pl-10 h-12 rounded-2xl bg-secondary/30 border-transparent focus-visible:ring-primary/30"
                            />
                        </div>

                        <form onSubmit={handleAgregarAlCarrito} className="space-y-4">
                            <div className="space-y-1.5">
                                <select
                                    value={productoSeleccionadoId}
                                    onChange={(e) => setProductoSeleccionadoId(e.target.value)}
                                    className="w-full h-12 px-4 rounded-2xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="">-- Seleccionar producto --</option>
                                    {productosFiltradosParaSelect.map((p) => (
                                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                                            {p.nombre} ({p.stock} pzs) - ${p.precio_venta.toFixed(2)} MXN
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-4 items-end">
                                <div className="space-y-1.5 w-1/3">
                                    <label className="text-sm font-semibold text-muted-foreground ml-1">Cant.</label>
                                    <Input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="h-12 rounded-2xl text-center font-bold" />
                                </div>
                                <Button type="submit" variant="secondary" className="h-12 w-2/3 rounded-2xl bg-secondary hover:bg-primary/20 text-primary transition-colors font-bold" disabled={!productoSeleccionadoId}>
                                    + Al Carrito
                                </Button>
                            </div>
                        </form>
                    </Card>

                    <Card className="p-0 rounded-3xl shadow-sm border-border/50 bg-white overflow-hidden flex flex-col">
                        <div className="p-5 bg-primary/5 border-b border-border/50">
                            <h2 className="text-lg font-bold text-primary flex justify-between items-center">
                                <span><ShoppingCart size={20} className="inline mr-2" /> Ticket Actual</span>
                                <span className="text-sm font-normal bg-white px-3 py-1 rounded-full shadow-sm">{carrito.length} artículos</span>
                            </h2>
                        </div>

                        <div className="p-5 flex-1 min-h-[200px] max-h-[300px] overflow-y-auto space-y-3">
                            {carrito.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 pt-8">
                                    <ShoppingCart size={40} className="mb-3 opacity-40" />
                                    <p className="text-sm font-medium">El carrito está vacío</p>
                                </div>
                            ) : (
                                carrito.map((item) => (
                                    <div key={item.producto_id} className="flex justify-between items-center p-3 bg-secondary/30 rounded-2xl">
                                        <div>
                                            <p className="font-bold text-sm text-foreground">{item.nombre}</p>
                                            <p className="text-xs text-muted-foreground">{item.cantidad} x ${item.precio.toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-primary">${item.subtotal.toFixed(2)}</span>
                                            <button onClick={() => quitarDelCarrito(item.producto_id)} className="text-destructive hover:bg-destructive/10 p-2 rounded-xl transition-all">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-5 bg-primary/5 border-t border-border/50 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-muted-foreground">Total General:</span>
                                <span className="text-3xl font-black text-primary">${totalCarrito.toFixed(2)} MXN</span>
                            </div>
                            <Button onClick={handleCobrar} disabled={carrito.length === 0 || cobrando} className={`w-full h-14 rounded-2xl text-lg font-bold shadow-lg ${isOnline ? 'shadow-primary/10' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'}`}>
                                {cobrando ? 'Procesando...' : isOnline ? '💳 Cobrar Ticket' : '💾 Guardar Ticket (Offline)'}
                            </Button>
                        </div>
                    </Card>
                </div>

                {/* TABLA HISTORIAL */}
                <div className="lg:col-span-7">
                    <Card className="p-6 rounded-3xl shadow-sm border-border/50 bg-white h-full">
                        <h2 className="text-xl font-bold text-foreground mb-6">Registro del Día</h2>
                        {loading ? (
                            <div className="animate-pulse space-y-4"><div className="h-12 bg-secondary/50 rounded-xl"></div></div>
                        ) : (
                            <div className="rounded-2xl border border-border/50 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-secondary/30">
                                        <TableRow>
                                            <TableHead className="pl-4">Hora</TableHead>
                                            <TableHead>Producto</TableHead>
                                            <TableHead className="text-right">Cant</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-center">Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ventas.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">Aún no hay ventas registradas.</TableCell>
                                            </TableRow>
                                        ) : (
                                            ventas.map((v) => (
                                                <TableRow key={v.id} className="transition-colors hover:bg-secondary/10">
                                                    <TableCell className="text-sm text-muted-foreground pl-4">
                                                        {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-foreground">{v.Inventario?.nombre || v.nombre_offline || 'Desconocido'}</TableCell>
                                                    <TableCell className="text-right font-medium">{v.cantidad} pzs</TableCell>
                                                    <TableCell className="text-right font-black text-primary">${v.total.toFixed(2)}</TableCell>
                                                    <TableCell className="text-center">
                                                        {v.offline ? (
                                                            <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-lg flex items-center justify-center gap-1 w-fit mx-auto">
                                                                <CloudOff size={12} /> Pendiente
                                                            </span>
                                                        ) : (
                                                            <Button variant="ghost" size="sm" onClick={() => handleEliminarVenta(v)} className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl">
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </Card>
                </div>

            </div>
        </div>
    )
}