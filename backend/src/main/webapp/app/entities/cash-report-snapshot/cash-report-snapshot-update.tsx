import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getAppUsers } from 'app/entities/app-user/app-user.reducer';
import { getEntities as getFarms } from 'app/entities/farm/farm.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './cash-report-snapshot.reducer';

export const CashReportSnapshotUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const appUsers = useAppSelector(state => state.appUser.entities);
  const farms = useAppSelector(state => state.farm.entities);
  const cashReportSnapshotEntity = useAppSelector(state => state.cashReportSnapshot.entity);
  const loading = useAppSelector(state => state.cashReportSnapshot.loading);
  const updating = useAppSelector(state => state.cashReportSnapshot.updating);
  const updateSuccess = useAppSelector(state => state.cashReportSnapshot.updateSuccess);

  const handleClose = () => {
    navigate('/cash-report-snapshot');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getAppUsers({}));
    dispatch(getFarms({}));
  }, []);

  useEffect(() => {
    if (updateSuccess) {
      handleClose();
    }
  }, [updateSuccess]);

  const saveEntity = values => {
    if (values.id !== undefined && typeof values.id !== 'number') {
      values.id = Number(values.id);
    }
    values.asOf = convertDateTimeToServer(values.asOf);
    if (values.totals !== undefined && typeof values.totals !== 'number') {
      values.totals = Number(values.totals);
    }

    const entity = {
      ...cashReportSnapshotEntity,
      ...values,
      pmUser: appUsers.find(it => it.id.toString() === values.pmUser?.toString()),
      farm: farms.find(it => it.id.toString() === values.farm?.toString()),
    };

    if (isNew) {
      dispatch(createEntity(entity));
    } else {
      dispatch(updateEntity(entity));
    }
  };

  const defaultValues = () =>
    isNew
      ? {
          asOf: displayDefaultDateTime(),
        }
      : {
          ...cashReportSnapshotEntity,
          asOf: convertDateTimeFromServer(cashReportSnapshotEntity.asOf),
          pmUser: cashReportSnapshotEntity?.pmUser?.id,
          farm: cashReportSnapshotEntity?.farm?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.cashReportSnapshot.home.createOrEditLabel" data-cy="CashReportSnapshotCreateUpdateHeading">
            Thêm mới hoặc cập nhật Cash Report Snapshot
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && (
                <ValidatedField name="id" required readOnly id="cash-report-snapshot-id" label="ID" validate={{ required: true }} />
              )}
              <ValidatedField
                label="As Of"
                id="cash-report-snapshot-asOf"
                name="asOf"
                data-cy="asOf"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Date From"
                id="cash-report-snapshot-dateFrom"
                name="dateFrom"
                data-cy="dateFrom"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: date_range - tách 2 cột</Tooltip>}>
                <span id="dateFromLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Date To"
                id="cash-report-snapshot-dateTo"
                name="dateTo"
                data-cy="dateTo"
                type="date"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Totals"
                id="cash-report-snapshot-totals"
                name="totals"
                data-cy="totals"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField id="cash-report-snapshot-pmUser" name="pmUser" data-cy="pmUser" label="Pm User" type="select" required>
                <option value="" key="0" />
                {appUsers
                  ? appUsers.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="cash-report-snapshot-farm" name="farm" data-cy="farm" label="Farm" type="select">
                <option value="" key="0" />
                {farms
                  ? farms.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <Button
                as={Link as any}
                id="cancel-save"
                data-cy="entityCreateCancelButton"
                to="/cash-report-snapshot"
                replace
                variant="info"
              >
                <FontAwesomeIcon icon="arrow-left" />
                &nbsp;
                <span className="d-none d-md-inline">Quay lại</span>
              </Button>
              &nbsp;
              <Button variant="primary" id="save-entity" data-cy="entityCreateSaveButton" type="submit" disabled={updating}>
                <FontAwesomeIcon icon="save" />
                &nbsp; Lưu
              </Button>
            </ValidatedForm>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default CashReportSnapshotUpdate;
