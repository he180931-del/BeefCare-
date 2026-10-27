import React, { useEffect, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { deleteEntity, getEntity } from './pregnancy-update.reducer';

export const PregnancyUpdateDeleteDialog = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams<'id'>();

  const [loadModal, setLoadModal] = useState(false);

  useEffect(() => {
    dispatch(getEntity(id!));
    setLoadModal(true);
  }, []);

  const pregnancyUpdateEntity = useAppSelector(state => state.pregnancyUpdate.entity);
  const updateSuccess = useAppSelector(state => state.pregnancyUpdate.updateSuccess);

  const handleClose = () => {
    navigate('/pregnancy-update');
  };

  useEffect(() => {
    if (updateSuccess && loadModal) {
      handleClose();
      setLoadModal(false);
    }
  }, [updateSuccess]);

  const confirmDelete = () => {
    dispatch(deleteEntity(pregnancyUpdateEntity.id));
  };

  return (
    <Modal show onHide={handleClose}>
      <ModalHeader data-cy="pregnancyUpdateDeleteDialogHeading" closeButton>
        Xác nhận hành động xóa
      </ModalHeader>
      <ModalBody id="beefcareApp.pregnancyUpdate.delete.question">
        Bạn có chắc là muốn xóa Pregnancy Update {pregnancyUpdateEntity.id}?
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          <FontAwesomeIcon icon="ban" />
          &nbsp; Hủy
        </Button>
        <Button id="jhi-confirm-delete-pregnancyUpdate" data-cy="entityConfirmDeleteButton" variant="danger" onClick={confirmDelete}>
          <FontAwesomeIcon icon="trash" />
          &nbsp; Xóa
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default PregnancyUpdateDeleteDialog;
