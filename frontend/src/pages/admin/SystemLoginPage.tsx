import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { useEffect } from 'react';

interface LoginForm {
  username: string;
  password: string;
}

export default function SystemLoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>();

  useEffect(() => {
    if (user?.role === 'system_admin') {
      navigate('/admin/dashboard');
    }
  }, [user, navigate]);

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.username, data.password);
      navigate('/admin/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Anmeldung fehlgeschlagen');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-2xl mb-4">
            <CalendarIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Festivo-Event</h1>
          <p className="text-primary-300 mt-1 text-sm">Systemadministration</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Anmelden</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Benutzername</label>
              <input
                {...register('username', { required: 'Pflichtfeld' })}
                className="input"
                placeholder="admin"
                autoComplete="username"
              />
              {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>}
            </div>

            <div>
              <label className="label">Passwort</label>
              <input
                {...register('password', { required: 'Pflichtfeld' })}
                type="password"
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full mt-2"
            >
              {isSubmitting ? 'Wird angemeldet...' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
