import { Outlet } from 'react-router-dom';

// project imports
import GuestGuard from 'utils/route-guard/GuestGuard';

// ==============================|| LAYOUT - AUTH ||============================== //

export default function AuthLayout() {
  return (
    <GuestGuard>
      <Outlet />
    </GuestGuard>
  );
}
