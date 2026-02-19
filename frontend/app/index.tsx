import { StyleSheet, Text, View } from "react-native";

const Home = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.title} >Home</Text>
            <Text>Holaaaaaaaaaaaa</Text>
        </View>
    )
}

export default Home

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    title: {
        fontWeight: 'bold',
        fontSize: 18
    }
})