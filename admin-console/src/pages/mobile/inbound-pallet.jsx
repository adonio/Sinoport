import { Navigate, useParams } from 'react-router-dom';

import { InboundFlightAppShell, PalletPanel, useInboundStorage } from 'pages/mobile/inbound-shared';
import { useGetMobileInboundDetail } from 'api/station';

export default function MobileInboundPalletPage() {
  const { flightNo } = useParams();
  const { mobileInboundFlightDetail, mobileInboundFlightDetailLoading } = useGetMobileInboundDetail(flightNo);
  const { taskMap, pallets } = useInboundStorage(flightNo);
  const flight = mobileInboundFlightDetail?.flight || null;
  const waybills = mobileInboundFlightDetail?.waybills || [];

  if (mobileInboundFlightDetailLoading) {
    return null;
  }

  if (!flight) {
    return <Navigate to="/mobile/inbound" replace />;
  }

  return (
    <InboundFlightAppShell flight={flight} waybills={waybills} taskMap={taskMap} showHero={false}>
      <PalletPanel flightNo={flight.flightNo} pallets={pallets} />
    </InboundFlightAppShell>
  );
}
