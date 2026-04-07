import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

import Loadable from 'components/Loadable';
import MobileLayout from 'layout/Mobile';
import PagesLayout from 'layout/Pages';
import MobileAuthGuard from 'utils/route-guard/MobileAuthGuard';
import MobileGuestGuard from 'utils/route-guard/MobileGuestGuard';

const MobileLoginPage = Loadable(lazy(() => import('pages/mobile/login')));
const MobileSelectPage = Loadable(lazy(() => import('pages/mobile/select')));
const MobileInboundPage = Loadable(lazy(() => import('pages/mobile/inbound')));
const MobileInboundFlightPage = Loadable(lazy(() => import('pages/mobile/inbound-flight')));
const MobileInboundBreakdownPage = Loadable(lazy(() => import('pages/mobile/inbound-breakdown')));
const MobileInboundPalletPage = Loadable(lazy(() => import('pages/mobile/inbound-pallet')));
const MobileInboundPalletNewPage = Loadable(lazy(() => import('pages/mobile/inbound-pallet-new')));
const MobileInboundLoadingPage = Loadable(lazy(() => import('pages/mobile/inbound-loading')));
const MobileInboundLoadingNewPage = Loadable(lazy(() => import('pages/mobile/inbound-loading-new')));
const MobileInboundLoadingPlanPage = Loadable(lazy(() => import('pages/mobile/inbound-loading-plan')));
const MobileOutboundPage = Loadable(lazy(() => import('pages/mobile/outbound')));
const MobileOutboundFlightPage = Loadable(lazy(() => import('pages/mobile/outbound-flight')));
const MobileOutboundReceiptPage = Loadable(lazy(() => import('pages/mobile/outbound-receipt')));
const MobileOutboundCountingPage = Loadable(lazy(() => import('pages/mobile/outbound-counting')));
const MobileOutboundPmcPage = Loadable(lazy(() => import('pages/mobile/outbound-pmc')));
const MobileOutboundPmcNewPage = Loadable(lazy(() => import('pages/mobile/outbound-pmc-new')));
const MobileOutboundPmcDetailPage = Loadable(lazy(() => import('pages/mobile/outbound-pmc-detail')));
const MobileOutboundLoadingPage = Loadable(lazy(() => import('pages/mobile/outbound-loading')));

const MobileRoutes = {
  path: '/mobile',
  children: [
    {
      index: true,
      element: <Navigate to="/mobile/login" replace />
    },
    {
      path: 'login',
      element: (
        <MobileGuestGuard>
          <PagesLayout />
        </MobileGuestGuard>
      ),
      children: [{ index: true, element: <MobileLoginPage /> }]
    },
    {
      path: '',
      element: (
        <MobileAuthGuard>
          <MobileLayout />
        </MobileAuthGuard>
      ),
      children: [
        { path: 'select', element: <MobileSelectPage /> },
        { path: 'inbound', element: <MobileInboundPage /> },
        { path: 'inbound/:flightNo', element: <MobileInboundFlightPage /> },
        { path: 'inbound/:flightNo/breakdown', element: <MobileInboundBreakdownPage /> },
        { path: 'inbound/:flightNo/pallet', element: <MobileInboundPalletPage /> },
        { path: 'inbound/:flightNo/pallet/new', element: <MobileInboundPalletNewPage /> },
        { path: 'inbound/:flightNo/loading', element: <MobileInboundLoadingPage /> },
        { path: 'inbound/:flightNo/loading/new', element: <MobileInboundLoadingNewPage /> },
        { path: 'inbound/:flightNo/loading/plan/:planId', element: <MobileInboundLoadingPlanPage /> },
        { path: 'outbound', element: <MobileOutboundPage /> },
        { path: 'outbound/:flightNo', element: <MobileOutboundFlightPage /> },
        { path: 'outbound/:flightNo/receipt', element: <MobileOutboundReceiptPage /> },
        { path: 'outbound/:flightNo/receipt/counting', element: <MobileOutboundCountingPage /> },
        { path: 'outbound/:flightNo/receipt/counting/:awb', element: <MobileOutboundCountingPage /> },
        { path: 'outbound/:flightNo/pmc', element: <MobileOutboundPmcPage /> },
        { path: 'outbound/:flightNo/pmc/new', element: <MobileOutboundPmcNewPage /> },
        { path: 'outbound/:flightNo/pmc/:containerCode', element: <MobileOutboundPmcDetailPage /> },
        { path: 'outbound/:flightNo/loading', element: <MobileOutboundLoadingPage /> }
      ]
    }
  ]
};

export default MobileRoutes;
