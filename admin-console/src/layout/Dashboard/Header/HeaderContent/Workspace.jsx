import PropTypes from 'prop-types';
import { useRef, useState } from 'react';

import useMediaQuery from '@mui/material/useMediaQuery';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Avatar from '@mui/material/Avatar';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';

// project imports
import Transitions from 'components/@extended/Transitions';
import { workspaceData } from './data/workspace-data';
import { getImageUrl, ImagePath } from 'utils/getImageUrl';

// assets
import DownOutlined from '@ant-design/icons/DownOutlined';

const colors = {
  Free: 'default',
  Pro: 'primary',
  Platform: 'primary',
  Station: 'secondary'
};

// ==============================|| WORKSPACE - LABEL ||============================== //

function Label({ title, sx }) {
  return <Chip label={title} size="small" color={colors[title]} sx={{ height: 20, ...sx }} />;
}

// ==============================|| HEADER CONTENT - WORKSPACE ||============================== //

export default function Workspace() {
  const downSM = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState(workspaceData[0]);

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    setOpen(false);
  };

  const onWorkspaceChange = (newValue) => {
    setWorkspace(newValue);
    setOpen(false);
    if (newValue.path) navigate(newValue.path);
  };

  return (
    <Box>
      <ButtonBase
        disableRipple
        ref={anchorRef}
        tabIndex={0}
        onClick={handleToggle}
        sx={{
          height: 38,
          minWidth: { xs: 60, sm: 200 },
          border: '1px solid',
          borderColor: 'divider',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          justifyContent: 'flex-start',
          gap: 0.75,
          '&:focus-visible': {
            outline: `2px solid`,
            outlineColor: 'secondary.dark'
          }
        }}
      >
        <Avatar
          alt={workspace.title}
          variant="rounded"
          src={getImageUrl(workspace.image, ImagePath.WORKSPACE)}
          sx={{ width: 24, height: 24 }}
        />

        {!downSM && (
          <>
            <Box component="span" sx={{ typography: 'h6', whiteSpace: 'nowrap' }}>
              {workspace.title}
            </Box>

            {workspace.label && <Label title={workspace.label} />}
          </>
        )}
        <Box sx={{ color: 'text.secondary', ml: 'auto' }}>
          <DownOutlined style={{ fontSize: 10 }} />
        </Box>
      </ButtonBase>
      <Popper
        placement={downMD ? 'bottom-start' : 'bottom'}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        popperOptions={{ modifiers: [{ name: 'offset', options: { offset: [downMD ? 0 : 0, 9] } }] }}
      >
        {({ TransitionProps }) => (
          <Transitions type="grow" position={downMD ? 'top-left' : 'top'} in={open} {...TransitionProps}>
            <Paper sx={(theme) => ({ boxShadow: theme.vars.customShadows.z1, width: 200 })}>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList>
                  {workspaceData.map((item, index) => (
                    <MenuItem
                      key={index}
                      selected={item.id === workspace.id}
                      onClick={() => onWorkspaceChange(item)}
                      sx={{ gap: 1, px: 1 }}
                    >
                      <Avatar
                        alt={item.title}
                        src={getImageUrl(item.image, ImagePath.WORKSPACE)}
                        variant="rounded"
                        sx={{ width: 24, height: 24 }}
                      />

                      <Typography noWrap component="span" variant="caption">
                        {item.title}
                      </Typography>

                      {item.label && <Label title={item.label} sx={{ ml: 'auto' }} />}
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Transitions>
        )}
      </Popper>
    </Box>
  );
}

Label.propTypes = { title: PropTypes.string, sx: PropTypes.any };
