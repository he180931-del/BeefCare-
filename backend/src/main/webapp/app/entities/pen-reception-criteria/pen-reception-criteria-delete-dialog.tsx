import React, { useEffect, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { deleteEntity, getEntity } from './pen-reception-criteria.reducer';

export const PenReceptionCriteriaDeleteDialog = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams<'id'>();

  const [loadModal, setLoadModal] = useState(false);

  useEffect(() => {
    dispatch(getEntity(id!));
    setLoadModal(true);
  }, []);

  const penReceptionCriteriaEntity = useAppSelector(state => state.penReceptionCriteria.entity);
  const updateSuccess = useAppSelector(state => state.penReceptionCriteria.updateSuccess);

  const handleClose = () => {
    navigate('/pen-reception-criteria');
  };

  useEffect(() => {
    if (updateSuccess && loadModal) {
      handleClose();
      setLoadModal(false);
    }
  }, [updateSuccess]);

  const confirmDelete = () => {
    dispatch(deleteEntity(penReceptionCriteriaEntity.id));
  };

  return (
    <Modal show onHide={handleClose}>
      <ModalHeader data-cy="penReceptionCriteriaDeleteDialogHeading" closeButton>
        Xác nhận hành động xóa
      </ModalHeader>
      <ModalBody id="beefcareApp.penReceptionCriteria.delete.question">
        Bạn có chắc là muốn xóa Pen Reception Criteria {penReceptionCriteriaEntity.id}?
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          <FontAwesomeIcon icon="ban" />
          &nbsp; Hủy
        </Button>
        <Button id="jhi-confirm-delete-penReceptionCriteria" data-cy="entityConfirmDeleteButton" variant="danger" onClick={confirmDelete}>
          <FontAwesomeIcon icon="trash" />
          &nbsp; Xóa
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default PenReceptionCriteriaDeleteDialog;
