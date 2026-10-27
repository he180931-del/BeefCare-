import React, { useEffect, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { deleteEntity, getEntity } from './cattle-profile-change.reducer';

export const CattleProfileChangeDeleteDialog = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams<'id'>();

  const [loadModal, setLoadModal] = useState(false);

  useEffect(() => {
    dispatch(getEntity(id!));
    setLoadModal(true);
  }, []);

  const cattleProfileChangeEntity = useAppSelector(state => state.cattleProfileChange.entity);
  const updateSuccess = useAppSelector(state => state.cattleProfileChange.updateSuccess);

  const handleClose = () => {
    navigate('/cattle-profile-change');
  };

  useEffect(() => {
    if (updateSuccess && loadModal) {
      handleClose();
      setLoadModal(false);
    }
  }, [updateSuccess]);

  const confirmDelete = () => {
    dispatch(deleteEntity(cattleProfileChangeEntity.id));
  };

  return (
    <Modal show onHide={handleClose}>
      <ModalHeader data-cy="cattleProfileChangeDeleteDialogHeading" closeButton>
        Xác nhận hành động xóa
      </ModalHeader>
      <ModalBody id="beefcareApp.cattleProfileChange.delete.question">
        Bạn có chắc là muốn xóa Cattle Profile Change {cattleProfileChangeEntity.id}?
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          <FontAwesomeIcon icon="ban" />
          &nbsp; Hủy
        </Button>
        <Button id="jhi-confirm-delete-cattleProfileChange" data-cy="entityConfirmDeleteButton" variant="danger" onClick={confirmDelete}>
          <FontAwesomeIcon icon="trash" />
          &nbsp; Xóa
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CattleProfileChangeDeleteDialog;
