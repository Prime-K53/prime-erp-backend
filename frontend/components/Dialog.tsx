import React from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface DivProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={() => onOpenChange?.(false)}
    >
      <div 
        className="relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

const DialogContent: React.FC<DivProps> = ({ className = '', children, ...props }) => (
  <div className={`w-full max-w-5xl rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur-xl shadow-2xl ring-1 ring-slate-200/60 ${className}`} {...props}>
    {children}
  </div>
);

const DialogHeader: React.FC<DivProps> = ({ className = '', ...props }) => (
  <div className={`relative px-8 py-6 border-b border-slate-200/60 bg-gradient-to-r from-slate-50/50 to-white/50 ${className}`} {...props} />
);

const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', ...props }) => (
  <h3 className={`text-xl font-semibold text-slate-900 tracking-tight ${className}`} {...props} />
);

const DialogFooter: React.FC<DivProps> = ({ className = '', ...props }) => (
  <div className={`px-8 py-6 border-t border-slate-200/60 bg-gradient-to-r from-white/50 to-slate-50/50 flex justify-end gap-3 ${className}`} {...props} />
);

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
export default Dialog;
