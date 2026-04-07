import { Navigate, useParams } from 'react-router-dom';

import { buildFlightWaybills, getInboundFlight, InboundFlightAppShell, PalletPanel, useInboundStorage } from 'pages/mobile/inbound-shared';

export default function MobileInboundPalletPage() {
  const { flightNo } = useParams();
  const flight = getInboundFlight(flightNo);
  const { taskMap, pallets, setPallets } = useInboundStorage();

  if (!flight) {
    return <Navigate to="/mobile/inbound" replace />;
  }

  const waybills = buildFlightWaybills(flight.flightNo);

  return (
    <InboundFlightAppShell flight={flight} waybills={waybills} taskMap={taskMap} showHero={false}>
      <PalletPanel flightNo={flight.flightNo} pallets={pallets} />
    </InboundFlightAppShell>
  );
}
