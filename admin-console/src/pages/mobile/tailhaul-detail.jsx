import { Navigate, useParams } from 'react-router-dom';

import { getMobileNodeDetail } from 'data/sinoport-adapters';
import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileTailhaulDetailPage() {
  const { tripId } = useParams();
  if (!getMobileNodeDetail('tailhaul', tripId)) {
    return <Navigate to="/mobile/tailhaul" replace />;
  }
  return <MobileNodeDetailPage flowKey="tailhaul" itemId={tripId} backPath="/mobile/tailhaul" />;
}
