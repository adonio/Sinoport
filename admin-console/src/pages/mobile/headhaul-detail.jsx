import { Navigate, useParams } from 'react-router-dom';

import { getMobileNodeDetail } from 'data/sinoport-adapters';
import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileHeadhaulDetailPage() {
  const { tripId } = useParams();
  if (!getMobileNodeDetail('headhaul', tripId)) {
    return <Navigate to="/mobile/headhaul" replace />;
  }
  return <MobileNodeDetailPage flowKey="headhaul" itemId={tripId} backPath="/mobile/headhaul" />;
}
