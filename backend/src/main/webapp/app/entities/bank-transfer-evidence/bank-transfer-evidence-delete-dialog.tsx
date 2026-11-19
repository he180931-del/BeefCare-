import React, { useEffect, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { deleteEntity, getEntity } from './bank-transfer-evidence.reducer';

export const BankTransferEvidenceDeleteDialog = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams<'id'>();

  const [loadModal, setLoadModal] = useState(false);

  useEffect(() => {
    dispatch(getEntity(id!));
    setLoadModal(true);
  }, []);

  const bankTransferEvidenceEntity = useAppSelector(state => state.bankTransferEvidence.entity);
  const updateSuccess = useAppSelector(state => state.bankTransferEvidence.updateSuccess);

  const handleClose = () => {
    navigate('/bank-transfer-evidence');
  };

  useEffect(() => {
    if (updateSuccess && loadModal) {
      handleClose();
      setLoadModal(false);
    }
  }, [updateSuccess]);

  const confirmDelete = () => {
    dispatch(deleteEntity(bankTransferEvidenceEntity.id));
  };

  return (
    <Modal show onHide={handleClose}>
      <ModalHeader data-cy="bankTransferEvidenceDeleteDialogHeading" closeButton>
        Xác nhận hành động xóa
      </ModalHeader>
      <ModalBody id="beefcareApp.bankTransferEvidence.delete.question">
        Bạn có chắc là muốn xóa Bank Transfer Evidence {bankTransferEvidenceEntity.id}?
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          <FontAwesomeIcon icon="ban" />
          &nbsp; Hủy
        </Button>
        <Button id="jhi-confirm-delete-bankTransferEvidence" data-cy="entityConfirmDeleteButton" variant="danger" onClick={confirmDelete}>
          <FontAwesomeIcon icon="trash" />
          &nbsp; Xóa
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default BankTransferEvidenceDeleteDialog;
