import { supabase } from './supabase';

export const sincronizarVentasOffline = async () => {
    const pendientes = JSON.parse(localStorage.getItem('ventas_pendientes') || '[]');

    if (pendientes.length === 0) return { success: true, message: "Todo está al día." };

    try {
        // 1. Subir cada ticket
        for (const ticket of pendientes) {
            const nuevasVentas = ticket.items.map((item: any) => ({
                producto_id: item.producto_id,
                cantidad: item.cantidad,
                total: item.subtotal
            }));

            await supabase.from('Ventas').insert(nuevasVentas);

            // Actualizar inventario oficial en la nube
            for (const item of ticket.items) {
                const { data: prod } = await supabase.from('Inventario').select('stock').eq('id', item.producto_id).single();
                if (prod) {
                    await supabase.from('Inventario').update({ stock: prod.stock - item.cantidad }).eq('id', item.producto_id);
                }
            }
        }

        // 2. Limpiar la memoria del celular si hubo éxito
        localStorage.removeItem('ventas_pendientes');
        return { success: true, message: `✨ ¡Se subieron ${pendientes.length} tickets a la nube!` };

    } catch (error) {
        console.error("Error sincronizando:", error);
        return { success: false, message: "❌ Error al sincronizar. Revisa tu conexión a internet." };
    }
};