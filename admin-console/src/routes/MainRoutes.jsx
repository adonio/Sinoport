import { lazy } from 'react';

import Loadable from 'components/Loadable';
import DashboardLayout from 'layout/Dashboard';

const PlatformStationsPage = Loadable(lazy(() => import('pages/platform/stations')));
const PlatformNetworkPage = Loadable(lazy(() => import('pages/platform/network')));
const PlatformRulesPage = Loadable(lazy(() => import('pages/platform/rules')));
const PlatformAuditPage = Loadable(lazy(() => import('pages/platform/audit')));

const StationDashboardPage = Loadable(lazy(() => import('pages/station/dashboard')));
const StationInboundPage = Loadable(lazy(() => import('pages/station/inbound')));
const StationInboundMobilePage = Loadable(lazy(() => import('pages/station/inbound-mobile')));
const StationInboundFlightsPage = Loadable(lazy(() => import('pages/station/inbound-flights')));
const StationInboundFlightDetailPage = Loadable(lazy(() => import('pages/station/inbound-flight-detail')));
const StationInboundFlightCreatePage = Loadable(lazy(() => import('pages/station/inbound-flight-create')));
const StationInboundWaybillsPage = Loadable(lazy(() => import('pages/station/inbound-waybills')));
const StationOutboundPage = Loadable(lazy(() => import('pages/station/outbound')));
const StationOutboundFlightsPage = Loadable(lazy(() => import('pages/station/outbound-flights')));
const StationOutboundWaybillsPage = Loadable(lazy(() => import('pages/station/outbound-waybills')));
const StationFilesPage = Loadable(lazy(() => import('pages/station/files')));
const StationExceptionsPage = Loadable(lazy(() => import('pages/station/exceptions')));

const MainRoutes = {
  path: '/',
  children: [
    {
      path: '/',
      element: <DashboardLayout />,
      children: [
        {
          path: 'sample-page',
          element: <PlatformStationsPage />
        },
        {
          path: 'platform',
          children: [
            {
              path: 'stations',
              element: <PlatformStationsPage />
            },
            {
              path: 'network',
              element: <PlatformNetworkPage />
            },
            {
              path: 'rules',
              element: <PlatformRulesPage />
            },
            {
              path: 'audit',
              element: <PlatformAuditPage />
            }
          ]
        },
        {
          path: 'station',
          children: [
            {
              path: 'dashboard',
              element: <StationDashboardPage />
            },
            {
              path: 'inbound',
              children: [
                {
                  index: true,
                  element: <StationInboundPage />
                },
                {
                  path: 'mobile',
                  element: <StationInboundMobilePage />
                },
                {
                  path: 'flights',
                  element: <StationInboundFlightsPage />
                },
                {
                  path: 'flights/new',
                  element: <StationInboundFlightCreatePage />
                },
                {
                  path: 'flights/:flightNo',
                  element: <StationInboundFlightDetailPage />
                },
                {
                  path: 'waybills',
                  element: <StationInboundWaybillsPage />
                }
              ]
            },
            {
              path: 'outbound',
              children: [
                {
                  index: true,
                  element: <StationOutboundPage />
                },
                {
                  path: 'flights',
                  element: <StationOutboundFlightsPage />
                },
                {
                  path: 'waybills',
                  element: <StationOutboundWaybillsPage />
                }
              ]
            },
            {
              path: 'files',
              element: <StationFilesPage />
            },
            {
              path: 'exceptions',
              element: <StationExceptionsPage />
            }
          ]
        }
      ]
    }
  ]
};

export default MainRoutes;
