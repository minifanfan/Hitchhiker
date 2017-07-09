import React from 'react';
import { connect, Dispatch, MapStateToPropsFactory } from 'react-redux';
import { Input, Button, Dropdown, Select, Menu, Modal, TreeSelect, message } from 'antd';
import { HttpMethod } from '../../../common/http_method';
import { getActiveRecordSelector, getActiveRecordStateSelector, getActiveEnvIdSelector, getCollectionTreeDataSelector } from './selector';
import { actionCreator } from '../../../action/index';
import { SaveRecordType, SaveAsRecordType, SendRequestType, UpdateDisplayRecordType, UpdateTabRecordId } from '../../../action/record';
import { State } from '../../../state/index';
import { DtoRecord } from '../../../../../api/interfaces/dto_record';
import { newRecordFlag } from '../../../common/constants';
import { StringUtil } from '../../../utils/string_util';
import { TreeData } from 'antd/lib/tree-select/interface';
import * as _ from 'lodash';

const DButton = Dropdown.Button as any;
const Option = Select.Option;

interface RequestUrlPanelStateProps {

    record: DtoRecord;

    isRequesting: boolean;

    environment: string;

    collectionTreeData: TreeData[];

    cookies: _.Dictionary<_.Dictionary<string>>;
}

interface RequestUrlPanelDispatchProps {

    changeRecord(record: DtoRecord);

    saveAs(record: DtoRecord);

    save(record: DtoRecord);

    sendRequest(environment: string, record: DtoRecord);

    updateTabRecordId(oldId: string, newId: string);
}

type RequestUrlPanelProps = RequestUrlPanelStateProps & RequestUrlPanelDispatchProps;

interface RequestUrlPanelState {

    isSaveDlgOpen: boolean;

    isSaveAsDlgOpen: boolean;

    selectedFolderId?: string;
}

class RequestUrlPanel extends React.Component<RequestUrlPanelProps, RequestUrlPanelState> {

    constructor(props: RequestUrlPanelProps) {
        super(props);
        this.state = {
            isSaveAsDlgOpen: false,
            isSaveDlgOpen: false
        };
    }

    shouldComponentUpdate(nextProps: RequestUrlPanelStateProps, nextState: RequestUrlPanelState) {
        const { record, isRequesting, environment, collectionTreeData, cookies } = this.props;
        return record.url !== nextProps.record.url ||
            record.method !== nextProps.record.method ||
            isRequesting !== nextProps.isRequesting ||
            environment !== nextProps.environment ||
            collectionTreeData !== nextProps.collectionTreeData ||
            cookies !== nextProps.cookies ||
            !_.isEqual(this.state, nextState);
    }

    private getMethods = (defaultValue?: string) => {
        const value = (defaultValue || HttpMethod.GET).toUpperCase();
        const { record, changeRecord } = this.props;
        return (
            <Select defaultValue={value} onChange={e => changeRecord({ ...record, method: e.toString() })} style={{ width: 100 }}>
                {
                    Object.keys(HttpMethod).map(k =>
                        <Option key={k} value={k}>{k}</Option>)
                }
            </Select>
        );
    }

    private canSave = () => {
        if (this.props.record.name.trim() !== '') {
            return true;
        }
        message.warning('miss name');
        return false;
    }

    private onSaveAs = () => {
        if (this.canSave()) {
            this.setState({ ...this.state, isSaveAsDlgOpen: true });
        }
    }

    private onSave = () => {
        if (this.canSave()) {
            const { record } = this.props;
            if (record.id.startsWith(newRecordFlag)) {
                this.setState({ ...this.state, isSaveDlgOpen: true });
            } else {
                this.props.save(record);
            }
        }
    }

    private onSaveNew = (e) => {
        if (!this.state.selectedFolderId) {
            return;
        }
        const record = this.props.record;
        [record.collectionId, record.pid] = this.state.selectedFolderId.split('::');

        const oldRecordId = record.id;
        if (this.state.isSaveAsDlgOpen) {
            record.id = StringUtil.generateUID();
            this.props.saveAs(record);
            this.setState({ ...this.state, isSaveAsDlgOpen: false });
        } else {
            if (oldRecordId.startsWith(newRecordFlag)) {
                record.id = StringUtil.generateUID();
                this.props.updateTabRecordId(oldRecordId, record.id);
            }
            this.props.save(record);
            this.setState({ ...this.state, isSaveDlgOpen: false });
        }
    }

    private sendRequest = () => {
        const { record, environment, cookies } = this.props;
        const headers = [...record.headers || []];
        const hostName = new URL(record.url || '').hostname;
        const localCookies = hostName ? cookies[hostName] || [] : [];
        const cookieHeader = headers.find(h => h.isActive && (h.key || '').toLowerCase() === 'cookie');

        let recordCookies: _.Dictionary<string> = {};
        if (cookieHeader) {
            recordCookies = StringUtil.readCookies(cookieHeader.value || '');
        }
        const allCookies = { ...localCookies, ...recordCookies };
        _.remove(headers, h => h.key === 'Cookie');

        this.props.sendRequest(environment, { ...record, headers: [...headers, { key: 'Cookie', value: _.values(allCookies).join('; '), isActive: true }] });
    }

    public render() {

        const { record, isRequesting, changeRecord, collectionTreeData } = this.props;

        const menu = (
            <Menu onClick={this.onSaveAs}>
                <Menu.Item key="save_as">Save As</Menu.Item>
            </Menu>
        );

        return (
            <div className="ant-form-inline url-panel">
                <div className="ant-row ant-form-item req-url">
                    <Input
                        placeholder="please enter url of this request"
                        size="large"
                        spellCheck={false}
                        onChange={(e) => changeRecord({ ...record, url: e.currentTarget.value })}
                        addonBefore={this.getMethods(record.method)}
                        value={record.url} />
                </div>
                <div className="ant-row ant-form-item req-send">
                    <Button type="primary" icon="rocket" loading={isRequesting} onClick={this.sendRequest}>
                        Send
                    </Button>
                </div>
                <div className="ant-row ant-form-item req-save" style={{ marginRight: 0 }}>
                    <DButton overlay={menu} onClick={this.onSave}>
                        Save
                    </DButton>
                </div>

                <Modal
                    title="Save Request"
                    visible={this.state.isSaveDlgOpen || this.state.isSaveAsDlgOpen}
                    okText="OK"
                    cancelText="Cancel"
                    onOk={this.onSaveNew}
                    onCancel={() => this.setState({ ...this.state, isSaveDlgOpen: false, isSaveAsDlgOpen: false })}
                >
                    <div style={{ marginBottom: '8px' }}>Select collection/folder:</div>
                    <TreeSelect
                        allowClear={true}
                        style={{ width: '100%' }}
                        dropdownStyle={{ maxHeight: 500, overflow: 'auto' }}
                        placeholder="Please select collection / folder"
                        treeDefaultExpandAll={true}
                        value={this.state.selectedFolderId}
                        onChange={(e) => this.setState({ ...this.state, selectedFolderId: e })}
                        treeData={collectionTreeData} />
                </Modal>
            </div>
        );
    }
}

const makeMapStateToProps: MapStateToPropsFactory<any, any> = (initialState: any, ownProps: any) => {
    const getRecordState = getActiveRecordStateSelector();
    const getActiveEnvId = getActiveEnvIdSelector();
    const getActiveRecord = getActiveRecordSelector();
    const getTreeData = getCollectionTreeDataSelector();
    const mapStateToProps: (state: State) => RequestUrlPanelStateProps = state => {
        const recordState = getRecordState(state);
        return {
            isRequesting: !!recordState && recordState.isRequesting,
            environment: getActiveEnvId(state),
            record: getActiveRecord(state),
            collectionTreeData: getTreeData(state),
            cookies: state.localDataState.cookies
        };
    };
    return mapStateToProps;
};

const mapDispatchToProps = (dispatch: Dispatch<any>): RequestUrlPanelDispatchProps => {
    return {
        changeRecord: (record) => dispatch(actionCreator(UpdateDisplayRecordType, record)),
        save: (record) => dispatch(actionCreator(SaveRecordType, { isNew: false, record })),
        saveAs: (record) => dispatch(actionCreator(SaveAsRecordType, { isNew: true, record })),
        sendRequest: (environment, record) => dispatch(actionCreator(SendRequestType, { environment, record })),
        updateTabRecordId: (oldId, newId) => dispatch(actionCreator(UpdateTabRecordId, { oldId, newId })),
    };
};

export default connect(
    makeMapStateToProps,
    mapDispatchToProps,
)(RequestUrlPanel);