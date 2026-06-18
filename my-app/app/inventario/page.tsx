'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Search, Edit2, Trash2, PackagePlus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Producto {
    id: number
    nombre: string
    descripcion: string
    precio_costo: number
    precio_venta: number
    stock: number
}

export default function InventarioPage() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [busqueda, setBusqueda] = useState('')
    const [loading, setLoading] = useState(true)
    const [open, setOpen] = useState(false)
    const [productoEditandoId, setProductoEditandoId] = useState<number | null>(null)

    const [nombre, setNombre] = useState('')
    const [descripcion, setDescripcion] = useState('')
    const [precioCosto, setPrecioCosto] = useState('')
    const [precioVenta, setPrecioVenta] = useState('')
    const [stock, setStock] = useState('')
    const [saving, setSaving] = useState(false)

    const [toast, setToast] = useState({ visible: false, mensaje: '' })

    const mostrarToast = (mensaje: string) => {
        setToast({ visible: true, mensaje })
        setTimeout(() => setToast({ visible: false, mensaje: '' }), 3000)
    }

    const fetchProductos = async () => {
        setLoading(true)
        const { data } = await supabase.from('Inventario').select('*').order('nombre', { ascending: true })
        if (data) setProductos(data)
        setLoading(false)
    }

    useEffect(() => { fetchProductos() }, [])

    const productosFiltrados = productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(busqueda.toLowerCase()))
    )

    const handleEditar = (producto: Producto) => {
        setProductoEditandoId(producto.id)
        setNombre(producto.nombre)
        setDescripcion(producto.descripcion || '')
        setPrecioCosto(producto.precio_costo.toString())
        setPrecioVenta(producto.precio_venta.toString())
        setStock(producto.stock.toString())
        setOpen(true)
    }

    const handleNuevoProducto = () => {
        setProductoEditandoId(null); setNombre(''); setDescripcion(''); setPrecioCosto(''); setPrecioVenta(''); setStock('');
    }

    const handleEliminar = async (id: number, nombreProducto: string) => {
        if (!window.confirm(`¿Eliminar permanentemente "${nombreProducto}"?`)) return
        await supabase.from('Inventario').delete().eq('id', id)
        fetchProductos()
        mostrarToast('🗑️ Producto eliminado permanentemente.')
    }

    const handleGuardarProducto = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        const datosProducto = { nombre, descripcion, precio_costo: parseFloat(precioCosto), precio_venta: parseFloat(precioVenta), stock: parseInt(stock) }

        if (productoEditandoId) {
            await supabase.from('Inventario').update(datosProducto).eq('id', productoEditandoId)
        } else {
            await supabase.from('Inventario').insert([datosProducto])
        }
        setOpen(false)
        fetchProductos()
        mostrarToast(productoEditandoId ? '✏️ Catálogo actualizado.' : '📦 Producto guardado en bodega.')
        setSaving(false)
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6 relative animate-in fade-in duration-500">

            {/* BOTÓN REGRESAR */}
            <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-semibold bg-primary/10 hover:bg-primary/20 px-4 py-2.5 rounded-2xl w-fit">
                <ArrowLeft size={18} />
                Regresar al Panel
            </Link>

            <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out transform ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className="bg-primary text-white px-6 py-4 rounded-2xl shadow-xl font-medium flex items-center gap-3">{toast.mensaje}</div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Catálogo de Productos</h1>
                    <p className="text-muted-foreground mt-1">Administra existencias, costos y precios de venta en tiempo real.</p>
                </div>

                <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) handleNuevoProducto() }}>
                    <DialogTrigger asChild>
                        <Button onClick={handleNuevoProducto} className="rounded-2xl h-12 px-6 shadow-md hover:shadow-lg flex items-center gap-2">
                            <PackagePlus size={18} /> Agregar Producto
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] rounded-3xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl text-foreground">{productoEditandoId ? 'Editar Producto' : 'Añadir Nuevo Producto'}</DialogTitle>
                            <DialogDescription>Completa la información contable del artículo.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleGuardarProducto} className="space-y-4 pt-4">
                            <div className="space-y-1.5"><label className="text-sm font-semibold">Nombre del Artículo *</label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="rounded-2xl h-12" /></div>
                            <div className="space-y-1.5"><label className="text-sm font-semibold">Descripción / Detalles</label><Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="rounded-2xl h-12" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5"><label className="text-sm font-semibold">Precio Costo ($) *</label><Input type="number" step="0.01" value={precioCosto} onChange={(e) => setPrecioCosto(e.target.value)} required className="rounded-2xl h-12" /></div>
                                <div className="space-y-1.5"><label className="text-sm font-semibold">Precio Venta ($) *</label><Input type="number" step="0.01" value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} required className="rounded-2xl h-12" /></div>
                            </div>
                            <div className="space-y-1.5"><label className="text-sm font-semibold">Stock / Piezas iniciales *</label><Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} required className="rounded-2xl h-12" /></div>
                            <div className="flex justify-end pt-4"><Button type="submit" disabled={saving} className="rounded-2xl h-12 px-8">{saving ? 'Guardando...' : 'Guardar Artículo'}</Button></div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="p-2 rounded-3xl shadow-sm border-border/50 bg-white">
                <div className="p-4 border-b border-border/30 bg-primary/5 rounded-t-3xl">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/50" size={20} />
                        <Input
                            placeholder="Buscar por nombre o descripción..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="pl-10 h-12 rounded-2xl border-white shadow-sm focus-visible:ring-primary/30"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-4 space-y-3"><Skeleton className="h-12 w-full rounded-2xl" /></div>
                ) : (
                    <div className="overflow-hidden rounded-b-2xl">
                        <Table>
                            <TableHeader className="bg-secondary/20">
                                <TableRow>
                                    <TableHead className="pl-6">Producto</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-right">Costo</TableHead>
                                    <TableHead className="text-right">Venta</TableHead>
                                    <TableHead className="text-right">Stock</TableHead>
                                    <TableHead className="text-center pr-6">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {productosFiltrados.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center h-32 text-muted-foreground">No se encontraron productos en el inventario.</TableCell></TableRow>
                                ) : (
                                    productosFiltrados.map((producto) => (
                                        <TableRow key={producto.id} className="transition-colors hover:bg-secondary/10">
                                            <TableCell className="font-bold text-foreground pl-6">{producto.nombre}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{producto.descripcion || '-'}</TableCell>
                                            <TableCell className="text-right text-sm font-medium">${producto.precio_costo.toFixed(2)} MXN</TableCell>
                                            <TableCell className="text-right font-black text-primary">${producto.precio_venta.toFixed(2)} MXN</TableCell>
                                            <TableCell className={`text-right font-black ${producto.stock <= 3 ? 'text-destructive bg-destructive/10 px-2.5 py-1 rounded-xl inline-block mt-1.5' : 'text-foreground'}`}>{producto.stock} Pzs</TableCell>
                                            <TableCell className="text-center pr-6">
                                                <div className="flex justify-center gap-1.5">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEditar(producto)} className="h-9 w-9 p-0 text-primary hover:bg-primary/10 rounded-xl">
                                                        <Edit2 size={15} />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleEliminar(producto.id, producto.nombre)} className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 rounded-xl">
                                                        <Trash2 size={15} />
                                                    </Button>
                                                </div>
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
    )
}