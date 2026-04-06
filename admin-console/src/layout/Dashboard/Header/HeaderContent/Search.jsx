import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Chip from '@mui/material/Chip';
import Dialog, { dialogClasses } from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Grid from '@mui/material/Grid';
import Input from '@mui/material/Input';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import { PopupTransition } from 'components/@extended/Transitions';
import MainCard from 'components/MainCard';
import { searchData } from './data/search-data';

// assets
import SearchOutlined from '@ant-design/icons/SearchOutlined';

// ==============================|| HEADER CONTENT - SEARCH ||============================== //

export default function Search() {
  const theme = useTheme();
  const downSM = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  const navigate = useNavigate();

  const [isModalOpen, setModalOpen] = useState(false);
  const [value, setValue] = useState('');
  const [filteredData, setFilteredData] = useState([]);

  const handleInputChange = (event) => setValue(event.target.value);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // For Mac, "metaKey" = ⌘ (Command), For Windows/Linux "ctrlKey"
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); // prevent browser’s default search/shortcut
        setModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!value.trim()) {
        setFilteredData(searchData);
        return;
      }

      const lower = value.toLowerCase();

      const result = searchData
        .map((group) => {
          const matchedChilds = group.childs.filter((child) => child.title.toLowerCase().includes(lower));

          if (matchedChilds.length > 0) {
            return { ...group, childs: matchedChilds };
          }
          return null;
        })
        .filter(Boolean); // remove groups with no matches

      setFilteredData(result);
    }, 500);

    return () => clearTimeout(timeout);
  }, [value]);

  const handleClick = (path, isExternal = false) => {
    if (!isExternal) {
      navigate(path);
      onCloseDialoge();
    } else {
      window.open(path, '_blank');
    }
  };

  const onCloseDialoge = () => {
    setModalOpen(false);
    setValue('');
  };

  return (
    <>
      <Box>
        <Stack
          direction="row"
          tabIndex={0}
          sx={{
            height: 38,
            gap: 1,
            border: '1px solid',
            borderColor: 'divider',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            width: 'fit-content',
            alignItems: 'center',
            ':hover': { borderColor: 'primary.main', cursor: 'pointer' }
          }}
          onClick={() => setModalOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setModalOpen(true);
            }
          }}
        >
          <SearchOutlined />
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              bgcolor: 'grey.100',
              p: 0.5,
              borderRadius: 1,
              ...theme.applyStyles('dark', { bgcolor: 'action.hover' })
            }}
          >
            <svg
              viewBox="64 64 896 896"
              focusable="false"
              width="1em"
              height="1em"
              fill={theme.vars.palette.text.secondary}
              aria-hidden="true"
            >
              <path d="M370.8 554.4c-54.6 0-98.8 44.2-98.8 98.8s44.2 98.8 98.8 98.8 98.8-44.2 98.8-98.8v-42.4h84.7v42.4c0 54.6 44.2 98.8 98.8 98.8s98.8-44.2 98.8-98.8-44.2-98.8-98.8-98.8h-42.4v-84.7h42.4c54.6 0 98.8-44.2 98.8-98.8 0-54.6-44.2-98.8-98.8-98.8s-98.8 44.2-98.8 98.8v42.4h-84.7v-42.4c0-54.6-44.2-98.8-98.8-98.8S272 316.2 272 370.8s44.2 98.8 98.8 98.8h42.4v84.7h-42.4zm42.4 98.8c0 23.4-19 42.4-42.4 42.4s-42.4-19-42.4-42.4 19-42.4 42.4-42.4h42.4v42.4zm197.6-282.4c0-23.4 19-42.4 42.4-42.4s42.4 19 42.4 42.4-19 42.4-42.4 42.4h-42.4v-42.4zm0 240h42.4c23.4 0 42.4 19 42.4 42.4s-19 42.4-42.4 42.4-42.4-19-42.4-42.4v-42.4zM469.6 469.6h84.7v84.7h-84.7v-84.7zm-98.8-56.4c-23.4 0-42.4-19-42.4-42.4s19-42.4 42.4-42.4 42.4 19 42.4 42.4v42.4h-42.4z"></path>
            </svg>
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 0 }}>
              K
            </Typography>
          </Stack>
        </Stack>
      </Box>
      <Dialog
        maxWidth="sm"
        fullWidth
        onClose={onCloseDialoge}
        open={isModalOpen}
        slots={{ transition: PopupTransition }}
        sx={[
          {
            [`& .${dialogClasses.paper}`]: { mt: { xs: 3, sm: 5, md: 15 }, overflow: 'unset' },
            [`& .${dialogClasses.container}`]: { alignItems: 'flex-start' }
          }
        ]}
      >
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Input
            id="header-search"
            aria-describedby="header-search-text"
            slotProps={{ input: { 'aria-label': 'weight' } }}
            placeholder="Search..."
            disableUnderline
            autoFocus
            fullWidth
            value={value}
            onChange={handleInputChange}
            startAdornment={
              <InputAdornment position="start" sx={{ mr: { xs: 1.5, sm: 2 } }}>
                <SearchOutlined />
              </InputAdornment>
            }
            endAdornment={
              <InputAdornment position="end">
                <Chip label="Esc" size="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            }
            sx={{ ...(downSM ? theme.typography.h5 : theme.typography.h4) }}
          />
        </Box>
        <DialogContent dividers sx={{ borderBottom: 'none', px: { xs: 2, sm: 3 }, maxHeight: 475 }}>
          {filteredData.length > 0 ? (
            <Stack sx={{ gap: 2 }}>
              {filteredData.map((item, index) => (
                <Stack key={index} sx={{ gap: 1 }}>
                  <Typography sx={{ color: 'text.secondary' }}>{item.title}</Typography>
                  <Grid container spacing={{ xs: 1.5, sm: 3 }}>
                    {item.childs.map((childItem, index) => (
                      <Grid key={index} size={{ xs: 6, sm: 4, md: 3 }}>
                        <MainCard content={false} sx={{ ':hover': { borderColor: 'primary.main' } }}>
                          <Stack
                            tabIndex={0}
                            onClick={() => handleClick(childItem.path, childItem.isExternal)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleClick(childItem.path, childItem.isExternal);
                              }
                            }}
                            sx={{
                              alignItems: 'center',
                              p: { xs: 1, sm: 2 },
                              cursor: 'pointer',
                              textAlign: 'center',
                              textDecoration: 'none'
                            }}
                          >
                            <Box sx={{ fontSize: { xs: 24, sm: 30 }, color: 'primary.main' }}>{childItem.icon}</Box>
                            {childItem.title}
                          </Stack>
                        </MainCard>
                      </Grid>
                    ))}
                  </Grid>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Stack sx={{ gap: 1, textAlign: 'center', py: 6 }}>
              <Typography variant="h6">No Results Found</Typography>
              <Typography variant="body2" color="text.secondary">
                Try searching with different keywords or check your spelling.
              </Typography>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
