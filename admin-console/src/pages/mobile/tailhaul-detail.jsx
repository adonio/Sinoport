import { useParams } from 'react-router-dom';

import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileTailhaulDetailPage() {
  const { tripId } = useParams();
  return <MobileNodeDetailPage flowKey="tailhaul" itemId={tripId} backPath="/mobile/tailhaul" />;
}
