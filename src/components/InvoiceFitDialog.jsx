import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export default function InvoiceFitDialog({ children, onClose }) {
    const dialogRef = useRef(null);
    const areaRef = useRef(null);
    const invoiceRef = useRef(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const dialog = dialogRef.current;
        const area = areaRef.current;
        const invoice = invoiceRef.current;
        dialog.showModal();

        const fit = () => {
            setScale(Math.min(1, area.clientWidth / invoice.offsetWidth, area.clientHeight / invoice.offsetHeight));
        };
        const observer = new ResizeObserver(fit);
        observer.observe(area);
        observer.observe(invoice);
        fit();

        return () => {
            observer.disconnect();
            dialog.close();
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            aria-label="Full invoice"
            onCancel={onClose}
            className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-gray-100 p-2 open:flex open:flex-col no-print"
        >
            <button type="button" onClick={onClose} aria-label="Close full invoice"
                className="mb-1 self-end rounded-lg bg-gray-800 p-2 text-white">
                <X size={20} />
            </button>
            <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden">
                <div ref={invoiceRef} className="absolute inset-x-0 top-0 origin-top" style={{ transform: `scale(${scale})` }}>
                    {children}
                </div>
            </div>
        </dialog>
    );
}
