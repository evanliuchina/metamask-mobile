import React, { Component } from 'react';
import { ActivityIndicator, InteractionManager, StyleSheet, View } from 'react-native';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { toChecksumAddress } from 'ethereumjs-util';
import { colors } from '../../../styles/common';
import Transactions from '../../UI/Transactions';
import getNavbarOptions from '../../UI/Navbar';
import Networks, { isKnownNetwork } from '../../../util/networks';
import { showAlert } from '../../../actions/alert';

const styles = StyleSheet.create({
	wrapper: {
		flex: 1,
		backgroundColor: colors.white
	},
	loader: {
		backgroundColor: colors.white,
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center'
	}
});

/**
 * Main view for the Transaction history
 */
class TransactionsView extends Component {
	static navigationOptions = ({ navigation }) => getNavbarOptions('transactions_view.title', navigation);

	static propTypes = {
		/**
		 * ETH to current currency conversion rate
		 */
		conversionRate: PropTypes.number,
		/**
		 * Currency code of the currently-active currency
		 */
		currentCurrency: PropTypes.string,
		/**
		/* navigation object required to push new views
		*/
		navigation: PropTypes.object,
		/**
		 * A string that represents the selected address
		 */
		selectedAddress: PropTypes.string,
		/**
		 * An array that represents the user transactions
		 */
		transactions: PropTypes.array,
		/**
		 * A string represeting the network name
		 */
		networkType: PropTypes.string
	};

	state = {
		transactionsUpdated: false,
		loading: false
	};

	txs = [];
	txsPending = [];
	mounted = false;
	isNormalizing = false;
	scrollableTabViewRef = React.createRef();
	flatlistRef = null;

	async init() {
		this.mounted = true;
		this.normalizeTransactions();
	}

	componentDidMount() {
		InteractionManager.runAfterInteractions(() => {
			this.init();
		});
	}

	componentDidUpdate(prevProps) {
		if (
			prevProps.networkType !== this.props.networkType ||
			prevProps.selectedAddress !== this.props.selectedAddress
		) {
			this.showLoaderAndNormalize();
		} else {
			this.normalizeTransactions();
		}
	}

	showLoaderAndNormalize() {
		this.setState({ loading: true }, () => {
			this.normalizeTransactions();
		});
	}

	componentWillUnmount() {
		this.mounted = false;
	}

	didTxStatusesChange = newTxsPending => this.txsPending.length !== newTxsPending.length;

	normalizeTransactions() {
		if (this.isNormalizing) return;
		this.isNormalizing = true;
		const { selectedAddress, networkType, transactions } = this.props;
		const networkId = Networks[networkType].networkId;
		if (transactions.length) {
			const txs = transactions.filter(
				tx =>
					((tx.transaction.from && toChecksumAddress(tx.transaction.from) === selectedAddress) ||
						(tx.transaction.to && toChecksumAddress(tx.transaction.to) === selectedAddress)) &&
					((networkId && networkId.toString() === tx.networkID) ||
						(networkType === 'rpc' && !isKnownNetwork(tx.networkID))) &&
					tx.status !== 'unapproved'
			);

			txs.sort((a, b) => (a.time > b.time ? -1 : b.time > a.time ? 1 : 0));
			const newPendingTxs = txs.filter(tx => tx.status === 'pending');
			// To avoid extra re-renders we want to set the new txs only when
			// there's a new tx in the history or the status of one of the existing txs changed
			if (
				(this.txs.length === 0 && !this.state.transactionsUpdated) ||
				this.txs.length !== txs.length ||
				this.didTxStatusesChange(newPendingTxs)
			) {
				this.txs = txs;
				this.txsPending = newPendingTxs;
				this.setState({ transactionsUpdated: true, loading: false });
				// Attempt to scroll to the top when the TX statuses change
				setTimeout(() => {
					if (this.flatlistRef && this.flatlistRef.current) {
						this.flatlistRef.current.scrollToIndex({ index: 0, animated: true });
					}
				}, 1000);
			}
		} else if (!this.state.transactionsUpdated) {
			this.setState({ transactionsUpdated: true, loading: false });
		}
		this.isNormalizing = false;
	}

	renderLoader = () => (
		<View style={styles.loader}>
			<ActivityIndicator style={styles.loader} size="small" />
		</View>
	);

	storeRef = ref => {
		this.flatlistRef = ref;
	};

	render = () => {
		const { conversionRate, currentCurrency, selectedAddress, navigation, networkType } = this.props;

		return (
			<View style={styles.wrapper} testID={'wallet-screen'}>
				{this.state.loading ? (
					this.renderLoader()
				) : (
					<Transactions
						navigation={navigation}
						transactions={this.txs}
						conversionRate={conversionRate}
						currentCurrency={currentCurrency}
						selectedAddress={selectedAddress}
						networkType={networkType}
						loading={!this.state.transactionsUpdated}
						onRefSet={this.storeRef}
					/>
				)}
			</View>
		);
	};
}

const mapStateToProps = state => ({
	conversionRate: state.engine.backgroundState.CurrencyRateController.conversionRate,
	currentCurrency: state.engine.backgroundState.CurrencyRateController.currentCurrency,
	selectedAddress: state.engine.backgroundState.PreferencesController.selectedAddress,
	transactions: state.engine.backgroundState.TransactionController.transactions,
	networkType: state.engine.backgroundState.NetworkController.provider.type
});

const mapDispatchToProps = dispatch => ({
	showAlert: config => dispatch(showAlert(config))
});

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(TransactionsView);