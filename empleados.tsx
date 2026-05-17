import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  Building2, 
  CreditCard,
  MoreVertical,
  X,
  ArrowLeft,
  Edit,
  Briefcase
} from 'lucide-react';

// Modelo de datos solicitado
interface Empleado {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  dni: string;
  email: string;
  phone: string;
  birth_date: string;
  salario: number;
}

const mockEmpleados: Empleado[] = [
  {
    id: 'e1',
    company_id: 'COMP-A1',
    first_name: 'Carlos',
    last_name: 'Mendoza',
    dni: '32145678',
    email: 'cmendoza@taller.com',
    phone: '+54 11 1234-5678',
    birth_date: '1985-04-12',
    salario: 850000
  },
  {
    id: 'e2',
    company_id: 'COMP-A1',
    first_name: 'Lucia',
    last_name: 'Fernandez',
    dni: '35456789',
    email: 'lfernandez@taller.com',
    phone: '+54 11 2345-6789',
    birth_date: '1990-08-25',
    salario: 920000
  },
  {
    id: 'e3',
    company_id: 'COMP-A2',
    first_name: 'Javier',
    last_name: 'Gomez',
    dni: '28987654',
    email: 'jgomez@taller.com',
    phone: '+54 11 3456-7890',
    birth_date: '1982-11-03',
    salario: 1100000
  },
  {
    id: 'e4',
    company_id: 'COMP-A1',
    first_name: 'Mariana',
    last_name: 'Rios',
    dni: '40123456',
    email: 'mrios@taller.com',
    phone: '+54 11 4567-8901',
    birth_date: '1998-02-15',
    salario: 750000
  },
  {
    id: 'e5',
    company_id: 'COMP-A3',
    first_name: 'Roberto',
    last_name: 'Sanchez',
    dni: '25345678',
    email: 'rsanchez@taller.com',
    phone: '+54 11 5678-9012',
    birth_date: '1975-06-30',
    salario: 1300000
  },
  {
    id: 'e6',
    company_id: 'COMP-A2',
    first_name: 'Sofia',
    last_name: 'Lozano',
    dni: '38765432',
    email: 'slozano@taller.com',
    phone: '+54 11 6789-0123',
    birth_date: '1995-12-10',
    salario: 880000
  }
];

const EmpleadoDetail = ({ empleado, onBack }: { empleado: Empleado, onBack: () => void }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium px-2 py-1 -ml-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al directorio
        </button>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors shadow-sm">
          <Edit className="w-4 h-4" />
          Editar perfil
        </button>
      </div>

      {/* Header Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="h-32 bg-[#007B8F]/10 w-full relative">
        </div>
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <div className="h-24 w-24 rounded-full bg-white border-4 border-white shadow-sm flex items-center justify-center text-[#007B8F] bg-[#007B8F]/10">
              <span className="text-3xl font-bold">
                {empleado.first_name[0]}{empleado.last_name[0]}
              </span>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                Empleado Activo
              </span>
            </div>
          </div>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              {empleado.first_name} {empleado.last_name}
            </h1>
            <div className="text-gray-500 font-medium flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Empresa {empleado.company_id}
            </div>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Info Personal & Contacto */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Información Personal</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nombre Completo</dt>
                <dd className="text-gray-900 font-medium">{empleado.first_name} {empleado.last_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Documento (DNI)</dt>
                <dd className="text-gray-900 font-medium flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  {empleado.dni}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fecha de Nacimiento</dt>
                <dd className="text-gray-900 font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {formatDate(empleado.birth_date)}
                </dd>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Datos de Contacto</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Correo Electrónico</dt>
                  <dd className="text-gray-900 font-medium">{empleado.email}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Teléfono de contacto</dt>
                  <dd className="text-gray-900 font-medium">{empleado.phone}</dd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Laboral & Salario */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
               <Building2 className="w-32 h-32" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3 relative z-10">Laboral</h2>
            <div className="space-y-5 relative z-10">
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Company ID</dt>
                <dd className="text-gray-900 font-medium text-lg">{empleado.company_id}</dd>
              </div>
              
              <div className="pt-4 border-t border-gray-100">
                <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Salario Actual</dt>
                <dd className="text-3xl font-bold text-[#007B8F] flex items-center gap-1">
                  <DollarSign className="w-6 h-6" />
                  {formatPrice(empleado.salario).replace('$', '').trim()}
                </dd>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default function App() {
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Estados de los filtros
  const [salarioMin, setSalarioMin] = useState('');
  const [salarioMax, setSalarioMax] = useState('');
  const [fechaNacDesde, setFechaNacDesde] = useState('');
  const [fechaNacHasta, setFechaNacHasta] = useState('');
  const [companyId, setCompanyId] = useState('');

  const filteredEmpleados = useMemo(() => {
    return mockEmpleados.filter((empleado) => {
      // Filtro de búsqueda general (nombre, apellido, dni, email)
      const searchLower = searchTerm.toLowerCase();
      const fullName = `${empleado.first_name} ${empleado.last_name}`.toLowerCase();
      const matchesSearch = 
        fullName.includes(searchLower) ||
        empleado.dni.includes(searchLower) ||
        empleado.email.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Filtros por salario
      if (salarioMin && empleado.salario < Number(salarioMin)) return false;
      if (salarioMax && empleado.salario > Number(salarioMax)) return false;

      // Filtros por fecha de nacimiento
      if (fechaNacDesde && empleado.birth_date < fechaNacDesde) return false;
      if (fechaNacHasta && empleado.birth_date > fechaNacHasta) return false;

      // Filtro por compañía
      if (companyId && !empleado.company_id.toLowerCase().includes(companyId.toLowerCase())) return false;

      return true;
    });
  }, [searchTerm, salarioMin, salarioMax, fechaNacDesde, fechaNacHasta, companyId]);

  const clearFilters = () => {
    setSalarioMin('');
    setSalarioMax('');
    setFechaNacDesde('');
    setFechaNacHasta('');
    setCompanyId('');
  };

  const hasFilters = salarioMin || salarioMax || fechaNacDesde || fechaNacHasta || companyId;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const selectedEmpleado = useMemo(() => 
    mockEmpleados.find(e => e.id === selectedEmpleadoId), 
  [selectedEmpleadoId]);

  if (selectedEmpleado) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-900">
        <div className="max-w-4xl mx-auto">
          <EmpleadoDetail empleado={selectedEmpleado} onBack={() => setSelectedEmpleadoId(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">Directorio de Empleados</h1>
            <p className="text-gray-500 text-sm">Gestiona la nómina y datos personales del personal</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, DNI o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg font-medium transition-colors shadow-sm ${
                showFilters 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filtros {hasFilters && <span className="w-2 h-2 rounded-full bg-blue-600"></span>}
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#007B8F] hover:bg-[#00687A] text-white rounded-lg font-medium transition-colors shadow-sm shrink-0">
              <Plus className="w-5 h-5" />
              Nuevo empleado
            </button>
          </div>
        </div>

        {/* Panel Desplegable de Filtros Inplace */}
        {showFilters && (
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Filtros avanzados</h3>
              {hasFilters && (
                <button onClick={clearFilters} className="text-sm flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">
                  <X className="w-4 h-4" /> Limpiar filtros
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Company ID</label>
                <input 
                  type="text" 
                  placeholder="Ej: COMP-A1"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Salario mínimo ($)</label>
                <input 
                  type="number" 
                  placeholder="Ej: 500000"
                  value={salarioMin}
                  onChange={(e) => setSalarioMin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Salario máximo ($)</label>
                <input 
                  type="number" 
                  placeholder="Ej: 2000000"
                  value={salarioMax}
                  onChange={(e) => setSalarioMax(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Nacimiento desde</label>
                <input 
                  type="date" 
                  value={fechaNacDesde}
                  onChange={(e) => setFechaNacDesde(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Nacimiento hasta</label>
                <input 
                  type="date" 
                  value={fechaNacHasta}
                  onChange={(e) => setFechaNacHasta(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Las "3 listas" de empleados. Implementadas como una grilla de 3 columnas para maximizar el uso del espacio */}
        <div className="space-y-4">
          {filteredEmpleados.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <User className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No se encontraron empleados</h3>
              <p className="text-gray-500 mt-1">Prueba ajustando los filtros o la búsqueda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEmpleados.map((empleado) => (
                <div 
                  key={empleado.id} 
                  onClick={() => setSelectedEmpleadoId(empleado.id)}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer overflow-hidden flex flex-col"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
                    <div className="flex gap-4 items-center">
                      <div className="h-12 w-12 rounded-full bg-[#007B8F]/10 flex items-center justify-center text-[#007B8F] shrink-0">
                        <span className="text-lg font-bold">
                          {empleado.first_name[0]}{empleado.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">
                          {empleado.first_name} {empleado.last_name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>DNI {empleado.dni}</span>
                        </div>
                      </div>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-3.5 flex-1">
                    <div className="flex items-start gap-3 text-sm text-gray-700">
                      <Mail className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <span className="truncate" title={empleado.email}>{empleado.email}</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm text-gray-700">
                      <Phone className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <span>{empleado.phone}</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm text-gray-700">
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <span>Nacimiento: {formatDate(empleado.birth_date)}</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm text-gray-700">
                      <Building2 className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <span>Cód. Empresa: <span className="font-medium">{empleado.company_id}</span></span>
                    </div>
                  </div>

                  {/* Card Footer (Salario) */}
                  <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Salario Actual</span>
                    <span className="text-lg font-bold text-[#007B8F] flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {formatPrice(empleado.salario).replace('$', '').trim()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
