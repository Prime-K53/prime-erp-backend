import React from 'react';
import { Wrench, CreditCard, Barcode, Upload, MessageSquare, Calculator, TrendingUp } from 'lucide-react';
import GenericHub from './GenericHub';

const InternalToolsHub: React.FC = () => {
  const options = [
    {
      label: 'Cheque manager',
      description: 'Design and print company cheques with automated numbering and logs.',
      path: '/internal-tools/cheques',
      icon: <CreditCard />,
      color: 'bg-blue-50 text-blue-500'
    },
    {
      label: 'Barcode printer',
      description: 'Generate and print thermal labels for inventory and POS items.',
      path: '/internal-tools/barcodes',
      icon: <Barcode />,
      color: 'bg-slate-50 text-slate-500'
    },
    {
      label: 'Data migration',
      description: 'Bulk import/export tools for Excel and CSV data synchronization.',
      path: '/internal-tools/import',
      icon: <Upload />,
      color: 'bg-emerald-50 text-emerald-500'
    },
    {
      label: 'Chat hub',
      description: 'Internal team communication and real-time support messaging.',
      path: '/internal-tools/chat',
      icon: <MessageSquare />,
      color: 'bg-amber-50 text-amber-500'
    },
    {
      label: 'Smart pricing engine',
      description: 'Calculate item prices with market adjustments and generate revenue reports.',
      path: '/internal-tools/pricing',
      icon: <Calculator />,
      color: 'bg-indigo-50 text-indigo-500'
    },
    {
      label: 'Market adjustments',
      description: 'Manage global cost layers, inflation adjustments, and logistics surcharges.',
      path: '/internal-tools/adjustments',
      icon: <TrendingUp />,
      color: 'bg-amber-50 text-amber-500'
    }
  ];

  return (
    <GenericHub
      title="Internal tools"
      subtitle="Utility modules for administrative tasks, data management, and automation."
      options={options}
      accentColor="#64748b"
    />
  );
};

export default InternalToolsHub;
